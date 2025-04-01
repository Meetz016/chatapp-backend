import express from "express"
import { WebSocket, WebSocketServer } from "ws";
import { IUserInfo } from "./interfaces/user.interface";
import { v4 as uuidv4 } from "uuid";
import { CustomWebSocket } from "./interfaces/customWebsocket.interface";
import { IChatResponse, IRoomCreated, IRoomJoined, ISocketResponse } from "./interfaces/response";

const app = express();
const httpServer = app.listen(8080)

const wss = new WebSocketServer({ server: httpServer })
const rooms = new Map<string, Set<CustomWebSocket>>()


wss.on("connection", function connection(ws: CustomWebSocket) {
    ws.on("error", console.error)

    ws.on("message", function message(data: string, isBinary) {
        try {
            const res: IUserInfo = JSON.parse(data);
            if (res.type == "create") {
                //create a new room
                const roomId = uuidv4().split("-")[0];
                rooms.set(roomId, new Set([ws]));
                ws.username = res.username;
                ws.roomId = roomId

                const response: ISocketResponse<IRoomCreated> = {
                    type: "roomCreated",
                    data: {
                        roomId: roomId
                    },
                    message: "Room Creation Sucessful"
                }
                ws.send(JSON.stringify(response));
            } else if (res.type == "join") {
                const roomId = res.room_id;

                if (!roomId) {
                    const response: ISocketResponse<null> = {
                        type: "error",
                        data: null,
                        message: "No room Id Provided."
                    }
                    ws.send(JSON.stringify(response));
                    return;
                }
                //try to search if roomId Exists or not
                const room: Set<CustomWebSocket> | undefined = rooms.get(roomId ?? "")
                if (!room) {
                    const response: ISocketResponse<null> = {
                        type: "error",
                        data: null,
                        message: "Invalid Room Id.",
                        error: "Provide a valid Room Id."
                    }
                    ws.send(JSON.stringify(response));
                    return;
                }
                //if we get room just add the client ws to that room
                ws.username = res.username;
                ws.roomId = roomId
                room.add(ws)
                const response: ISocketResponse<IRoomJoined> = {
                    type: "roomJoined",
                    data: {
                        roomId: roomId
                    },
                    message: "Room Joined Successfully"
                }
                ws.send(JSON.stringify(response));

                room.forEach(client => {
                    if (client.readyState === WebSocket.OPEN) {
                        const allUsers: string[] = Array.from(room.values()).map(client => client.username)
                        const joinedMessage: ISocketResponse<{ username: string, allUsers: string[] }> = {
                            type: "userJoined",
                            data: { username: ws.username, allUsers: allUsers },
                            message: `${ws.username} has joined the room`
                        };
                        client.send(JSON.stringify(joinedMessage));
                    }
                });
            } else if (res.type == "chat") {
                //broadcast the message
                const roomId = ws.roomId;

                if (!roomId) {
                    const response: ISocketResponse<null> = {
                        type: "error",
                        data: null,
                        message: "You are not in a room.",
                    };
                    ws.send(JSON.stringify(response));
                    return;
                }


                const room: Set<CustomWebSocket> | undefined = rooms.get(roomId ?? "")
                if (!room) {
                    const response: ISocketResponse<null> = {
                        type: "error",
                        data: null,
                        message: "Invalid Room Id.",
                        error: "Provide a valid Room Id."
                    }
                    ws.send(JSON.stringify(response));
                    return;
                }
                if (!res.message) {
                    const response: ISocketResponse<null> = {
                        type: "error",
                        data: null,
                        message: "No message provided.",
                        error: "Message content is empty."
                    }
                    ws.send(JSON.stringify(response));
                    return;
                }

                room.forEach(client => {
                    if (client.readyState === WebSocket.OPEN) {
                        const chatResponse: ISocketResponse<IChatResponse> = {
                            type: "chat",
                            data: {
                                message: res.message ?? "",
                                sender: res.username
                            },
                            message: "New Message"
                        }
                        client.send(JSON.stringify(chatResponse));
                    }
                })
            }
        } catch (err) {
            console.log("not a valid json")
            ws.send(JSON.stringify({
                type: "error",
                data: null,
                message: "Invalid JSON payload.",
                error: "Message format is incorrect."
            }));

        }
    })

    ws.on("close", () => {
        const roomId = ws.roomId;

        if (!roomId) {
            const response: ISocketResponse<null> = {
                type: "error",
                data: null,
                message: "You are not in a room.",
            };
            ws.send(JSON.stringify(response));
            return;
        }
        const room: Set<CustomWebSocket> | undefined = rooms.get(roomId ?? "")

        if (!room) return;

        room.delete(ws)

        room.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                const allUsers: string[] = Array.from(room.values()).map(client => client.username)
                const joinedMessage: ISocketResponse<{ username: string, allUsers: string[] }> = {
                    type: "userLeft",
                    data: { username: ws.username, allUsers: allUsers },
                    message: `${ws.username} has left the room`
                };
                client.send(JSON.stringify(joinedMessage));
            }
        });

    })

})