import {
  WebSocketGateway, WebSocketServer,
  SubscribeMessage, MessageBody, ConnectedSocket, OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Injectable } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
 
@Injectable()
@WebSocketGateway({
  cors: { origin: process.env.FRONTEND_URL || 'http://localhost:3000' },
  namespace: '/tracking',
})
export class TrackingGateway implements OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;
 
  // Client joins a booking room to receive driver updates
  // Emit from frontend: socket.emit('subscribe-booking', { bookingId })
  @SubscribeMessage('subscribe-booking')
  handleSubscribe(
    @MessageBody() data: { bookingId: string },
    @ConnectedSocket() client: Socket,
  ) {
    client.join(`booking:${data.bookingId}`);
    return { event: 'subscribed', bookingId: data.bookingId };
  }
 
  @SubscribeMessage('unsubscribe-booking')
  handleUnsubscribe(
    @MessageBody() data: { bookingId: string },
    @ConnectedSocket() client: Socket,
  ) {
    client.leave(`booking:${data.bookingId}`);
  }
 
  handleDisconnect(client: Socket) {
    // Socket.IO auto-removes from all rooms on disconnect
  }
 
  // Called by DriverService on each GPS update
  broadcastDriverLocation(
    bookingId: string,
    payload: { lat: number; lng: number; status: string; estimatedArrival?: string },
  ) {
    this.server
      .to(`booking:${bookingId}`)
      .emit('driver-location', { bookingId, ...payload, timestamp: new Date().toISOString() });
  }
}
