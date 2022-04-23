const app = require("express")();
const server = require("http").createServer(app);
const cors = require("cors");
require("dotenv").config();

const io = require("socket.io")(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

app.use(cors());

app.get("/", (req, res) => {
  res.send("Running");
});
let peers = [];
let usersJoin = [];
const users = {};
const socketToRoom = {};
io.on("connection", (socket) => {
  socket.emit("me", socket.id);
  console.log("new user connected");
  console.log(socket.id);
  socket.on("disconnect", () => {
    console.log("user disconnected");
    peers = peers.filter((peer) => peer.socketId !== socket.id);
    io.sockets.emit("broadcast", peers);
    usersJoin = usersJoin.filter((socketId) => socketId !== socket.id);
    io.sockets.emit("receive-user-join", usersJoin);
  });
  socket.on("user-logout", (data) => {
    peers = peers.filter((peer) => peer.userId !== data.userId);
    io.sockets.emit("broadcast", peers);
  });
  socket.on("user-join", (data) => {
    let flag = true;
    usersJoin.map((user, index) => {
      if (user === data.socketId) {
        usersJoin.splice(index, 1, data.socketId);
        flag = false;
      }
    });
    if (flag) usersJoin.push(data.socketId);
    io.sockets.emit("receive-user-join", usersJoin);
  });
  socket.on("register-new-user", (data) => {
    let flag = true;
    peers.map((peer, index) => {
      if (peer.userId === data.userId) {
        peers.splice(index, 1, data);
        flag = false;
      }
    });
    if (flag) peers.push(data);
    console.log("broadcast ", peers);
    io.sockets.emit("broadcast", peers);
    io.sockets.emit("receive-user-join", usersJoin);
  });
  socket.on("send-feedback", (data) => {
    data.socketIds.forEach((socketId) => {
      io.to(socketId).emit("receive-feedback", data.feedback);
    });
  });
  socket.on("send-book", (data) => {
    data.socketIds.forEach((socketId) => {
      io.to(socketId).emit("receive-book", data);
    });
  });
  socket.on("send-message", (data) => {
    data.socketIds.forEach((socketId) => {
      io.to(socketId).emit("send-message", data);
    });
  });
  socket.on("read-message", (data) => {
    data.socketIds.forEach((socketId) => {
      io.to(socketId).emit("read-message", data);
    });
  });
  socket.on("delete-message", (data) => {
    data.socketIds.forEach((socketId) => {
      io.to(socketId).emit("delete-message", data);
    });
  });

  socket.on("join room", (data) => {
    console.log(" join room");
    if (users[data.roomId]) {
      const length = users[data.roomId].length;
      if (length === 10) {
        socket.emit("room full");
        return;
      }
      users[data.roomId].push({
        socketId: socket.id,
        userJoin: data.userJoin,
      });
    } else {
      users[data.roomId] = [
        {
          socketId: socket.id,
          userJoin: data.userJoin,
        },
      ];
    }
    socketToRoom[socket.id] = data.roomId;
    const usersInThisRoom = users[data.roomId].filter(
      (id) => id.socketId !== socket.id
    );
    console.log("usersin this room", usersInThisRoom);
    socket.emit("all users", {
      users: usersInThisRoom,
      userJoin: data.userJoin,
    });
  });

  socket.on("sending signal", (payload) => {
    io.to(payload.userToSignal).emit("user joined", {
      signal: payload.signal,
      callerID: payload.callerID,
      userJoin: payload.userJoin,
    });
  });

  socket.on("returning signal", (payload) => {
    console.log("return signal", payload);
    io.to(payload.callerID).emit("receiving returned signal", {
      signal: payload.signal,
      id: socket.id,
    });
  });
  socket.on("invite join room", (data) => {
    data.socketIds.forEach((socketId) => {
      io.to(socketId).emit("invite join room", data);
    });
  });
  socket.on("stop-meeting", (roomID) => {
    users[roomID].forEach((user) => {
      io.to(user.socketId).emit("stop-meeting", roomID);
    });
  });
  socket.on("update-message-stop-meeting", (data) => {
    data.socketIds.forEach((socketId) => {
      io.to(socketId).emit("update-message-stop-meeting", data);
    });
  });
  socket.on("cede host", (data) => {
    users[data.roomId].forEach((user) => {
      io.to(user.socketId).emit("cede host", data);
    });
  });
  socket.on("turn on video room", (data) => {
    users[data.roomId].forEach((user) => {
      io.to(user.socketId).emit("turn on video room", data.userTurnOn);
    });
  });
  socket.on("turn off video room", (data) => {
    users[data.roomId].forEach((user) => {
      io.to(user.socketId).emit("turn off video room", data.userTurnOff);
    });
  });
  socket.on("turn on audio room", (data) => {
    console.log("turn on audio room", data);
    users[data.roomId].forEach((user) => {
      io.to(user.socketId).emit("turn on audio room", data.userTurnOn);
    });
  });
  socket.on("turn off audio room", (data) => {
    console.log("turn  audio room", data);
    users[data.roomId].forEach((user) => {
      io.to(user.socketId).emit("turn off audio room", data.userTurnOff);
    });
  });
  socket.on("expel-member", (data) => {
    console.log("expel member", data);
    users[data.roomId]
      .filter((user) => user.socketId !== data.socketId)
      .forEach((socketId) => {
        io.to(socketId.socketId).emit("out-room-other", data);
      });
    // io.to(data.socketId).emit("out room", data);
    users[data.roomId] = users[data.roomId].filter(
      (user) => user.socketId !== data.socketId
    );
  });
  socket.on("notification-user-join", (data) => {
    users[data.roomId]
      .filter((user) => user.socketId !== data.socketId)
      .forEach((socketId) => {
        io.to(socketId.socketId).emit("notification-user-join", data);
      });
  });
  socket.on("send-message-meeting", (data) => {
    console.log("send-message-meeting", data);
    users[data.roomId]
      .filter((user) => user.socketId !== data.socketId)
      .forEach((socketId) => {
        io.to(socketId.socketId).emit("send-message-meeting", data);
      });
  });
  socket.on("share-screen", (data) => {
    console.log("share-screen", data);
    users[data.roomId]
      .filter((user) => user.socketId !== data.socketId)
      .forEach((socketId) => {
        io.to(socketId.socketId).emit("share-screen", data);
      });
  });
  socket.on("returning share-screen", (payload) => {
    console.log("return share-screen", payload);
    io.to(payload.callerID).emit("receiving returned share-screen", {
      signal: payload.signal,
      id: socket.id,
    });
  });
  socket.on("inputting-message", (data) => {
    data.socketIds.forEach((socketId) => {
      io.to(socketId).emit("inputting-message", data);
    });
  });
  socket.on("delete-inputting-message", (data) => {
    data.socketIds.forEach((socketId) => {
      io.to(socketId).emit("delete-inputting-message", data);
    });
  });
});
server.listen(process.env.PORT || 3001, () => {
  console.log("Server is running on port 3001");
});
