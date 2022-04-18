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
});
server.listen(process.env.PORT || 3001, () => {
  console.log("Server is running on port 3001");
});
