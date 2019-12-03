import io from "socket.io-client"

const socket = io("http://localhost:8080")
socket.on("connect", function() {
    console.log("connect")
})
socket.on("event", function() {
    console.log("event")
})
socket.on("disconnect", function() {
    console.log("disconnect")
})
socket.emit("qr-codes", {codes: [{publicKey: "fdhsoid"}]})
