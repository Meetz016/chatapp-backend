export interface ISocketResponse<T> {
    type: string,
    data: T,
    error?: any,
    message: string,
}


export interface IRoomCreated {
    roomId: string
}
