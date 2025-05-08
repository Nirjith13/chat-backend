const http = require('http');
const express = require('express');
const { Server } = require('socket.io');  // Updated import style
const cors = require('cors');

const { addUser, removeUser, getUser, getUsersInRoom } = require('./users');

const router = require('./router');

const app = express();
const server = http.createServer(app);

// Updated Socket.io configuration with CORS options
const io = new Server(server, {
  cors: {
    origin: "*",  // In production, specify your client's origin
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(router);

// Log when server starts listening for connections
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);
  
  socket.on('join', ({ name, room }, callback) => {
    console.log(`${name} attempting to join ${room}`);
    
    const { error, user } = addUser({ id: socket.id, name, room });

    if(error) {
      console.log('Join error:', error);
      return callback(error);
    }

    socket.join(user.room);

    socket.emit('message', { user: 'admin', text: `${user.name}, welcome to room ${user.room}.`});
    socket.broadcast.to(user.room).emit('message', { user: 'admin', text: `${user.name} has joined!` });

    io.to(user.room).emit('roomData', { room: user.room, users: getUsersInRoom(user.room) });

    callback();
  });

  socket.on('sendMessage', (message, callback) => {
    const user = getUser(socket.id);

    if (!user) {
      console.log('User not found for socket ID:', socket.id);
      return callback('User not found');
    }

    console.log(`Message from ${user.name} in ${user.room}: ${message}`);
    
    io.to(user.room).emit('message', { user: user.name, text: message });

    callback();
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    
    const user = removeUser(socket.id);

    if(user) {
      io.to(user.room).emit('message', { user: 'admin', text: `${user.name} has left.` });
      io.to(user.room).emit('roomData', { room: user.room, users: getUsersInRoom(user.room)});
    }
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server has started on port ${PORT}.`));