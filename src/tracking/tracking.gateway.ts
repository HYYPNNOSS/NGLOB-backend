import {
  WebSocketGateway, WebSocketServer,
  SubscribeMessage, MessageBody, ConnectedSocket, OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Injectable } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
 
@Injectable()
@WebSocketGateway({
  cors: { 
    origin: process.env.FRONTEND_URL 
      ? [process.env.FRONTEND_URL, 'https://ngob.vercel.app', 'https://www.nglob.com', 'https://nglob.com', 'https://app.nglob.com', 'http://localhost:3000'] 
      : ['https://ngob.vercel.app', 'https://www.nglob.com', 'https://nglob.com', 'https://app.nglob.com', 'http://localhost:3000']
  },
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

  @SubscribeMessage('subscribe-manager')
  handleSubscribeManager(@ConnectedSocket() client: Socket) {
    client.join('managers');
    return { event: 'subscribed', room: 'managers' };
  }

  @SubscribeMessage('subscribe-driver')
  handleSubscribeDriver(
    @MessageBody() data: { driverId: string },
    @ConnectedSocket() client: Socket,
  ) {
    client.join(`driver:${data.driverId}`);
    return { event: 'subscribed', driverId: data.driverId };
  }

  broadcastToManagers(event: string, payload?: any) {
    this.server.to('managers').emit(event, payload);
  }

  broadcastToDriver(driverId: string, event: string, payload?: any) {
    this.server.to(`driver:${driverId}`).emit(event, payload);
  }
 
  // Called by DriverService on each GPS update
  broadcastDriverLocation(
    bookingId: string,
    payload: { lat: number; lng: number; status: string; estimatedArrival?: string },
  ) {
    const data = { bookingId, ...payload, timestamp: new Date().toISOString() };
    this.server.to(`booking:${bookingId}`).emit('driver-location', data);
    this.server.to('managers').emit('driver-location', data);
  }
}
