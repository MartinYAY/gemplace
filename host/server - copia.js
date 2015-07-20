#!/usr/bin/env node

var WebSocketServer = require('websocket').server;
var http = require('http');
var fs = require('fs');

var server = http.createServer(function(request, response) {
    console.log((new Date()) + ' Received request for ' + request.url);
    response.writeHead(404);
    response.end();
});
server.listen(9001, function() {
    console.log((new Date()) + ' Server is listening on port 9001');
});

wsServer = new WebSocketServer({
    httpServer: server,
    autoAcceptConnections: false
});

function originIsAllowed(origin) {
    // undefined origin (i.e. non-web clients) always allowed
    if (!origin) {
        return true;
    } else if (process.argv.hasOwnProperty('2') && process.argv[2] === '--debug') {
        return true;
    } else {
        return origin === 'http://jarl.sytes.net';
    }
}

var badRegex = /fuck|shit|milf|bdsm|fag|faggot|nigga|nigger|clop|(\[\]\(\/[a-zA-Z0-9\-_]+\))/gi;

var validNickRegex = /^[a-zA-Z0-9_]+$/g;

var fs = require('fs');

function sanitiseChat(chat) {
    chat = chat.substr(0, 100);
    chat = chat.replace(badRegex, 'pony');
    // trim whitespace
    chat = chat.replace(/^\s+|\s+$/g, '');
    return chat;
}

function sanitisePosition(obj, roomName) {
    if (roomName !== null) {
        var room;
        if (roomManager.has(roomName)) {
            room = roomManager.get(roomName);
        } else if (roomName.substr(0, 6) === 'house ') {
            room = User.getHouse(roomName.substr(6));
        } else {
            room = {
                type: 'ephemeral',
                name: roomName
            };
        }

        if (room.type === 'ephemeral') {
            obj.x = Math.max(Math.min(obj.x, 960), 0);
        } else {
            obj.x = Math.max(Math.min(obj.x, room.background.width), 0);
        }
        obj.y = Math.max(Math.min(obj.y, 660), 0);
    }
    return obj;
}

var User = require('./user.js');

var banManager = {
    bannedIPs: [],

    init: function () {
        try {
            var data = JSON.parse(fs.readFileSync('data/bans.json'));
        } catch (e) {
            console.log('Error loading banned users info, skipped');
            return;
        }
        this.bannedIPs = data.IPs;
        console.log('Loaded banned users info');
    },
    save: function () {
        fs.writeFileSync('data/bans.json', JSON.stringify({
            IPs: this.bannedIPs
        }));
        console.log('Saved banned users info');
    },
    addIPBan: function (IP) {
        if (!this.isIPBanned(IP)) {
            this.bannedIPs.push(IP);
            this.save();
        }
    },
    unbanIP: function (IP) {
        if (this.isIPBanned(IP)) {
            this.bannedIPs.splice(this.bannedIPs.indexOf(IP), 1);
            this.save();
        }
    },
    isIPBanned: function (IP) {
        return (this.bannedIPs.indexOf(IP) !== -1);
    }
};

banManager.init();

var roomManager = {
    rooms: [],
    ephemeralRooms: [],

    init: function () {
        var data = JSON.parse(fs.readFileSync('data/rooms.json'));
        this.rooms = data;
        console.log('Loaded rooms');
    },
    has: function (name) {
        for (var i = 0; i < this.rooms.length; i++) {
            // room exists
            if (this.rooms[i].name === name) {
                return true;
            }
        }
        return false;
    },
    get: function (name) {
        for (var i = 0; i < this.rooms.length; i++) {
            if (this.rooms[i].name === name) {
                return this.rooms[i];
            }
        }
        throw new Error('There is no room with the name: "' + name + '"');
    },
    onEphemeralJoin: function (name) {
        if (this.ephemeralRooms.hasOwnProperty(name)) {
            this.ephemeralRooms[name]++;
        } else {
            this.ephemeralRooms[name] = 1;
        }
    },
    onEphemeralLeave: function (name) {
        if (this.ephemeralRooms.hasOwnProperty(name)) {
            this.ephemeralRooms[name]--;
            if (this.ephemeralRooms[name] <= 0) {
                delete this.ephemeralRooms[name];
            }
        }
    },
    getList: function () {
        var list = [];
        for (var i = 0; i < this.rooms.length; i++) {
            if (!this.rooms[i].unlisted) {
                list.push({
                    type: this.rooms[i].type,
                    name: this.rooms[i].name,
                    name_full: this.rooms[i].name_full,
                    user_count: this.rooms[i].user_count,
                    user_noun: this.rooms[i].user_noun,
                    thumbnail: this.rooms[i].thumbnail
                });
            }
        }
        for (var name in this.ephemeralRooms) {
            if (this.ephemeralRooms.hasOwnProperty(name)) {
                list.push({
                    type: 'ephemeral',
                    name: name,
                    user_count: this.ephemeralRooms[name],
                    thumbnail: '/ponyplace/media/rooms/cave-thumb.png'
                });
            }
        }
        return list;
    }
};

roomManager.init();

var modLogger = {
    log: [],

    init: function () {
        try {
            var data = fs.readFileSync('data/mod-log.json');
        } catch (e) {
            console.log('Error loading moderation log, skipped.');
            return;
        }
        data = JSON.parse(fs.readFileSync('data/mod-log.json'));
        this.log = data.log;
        console.log('Loaded moderation log');
    },
    save: function () {
        fs.writeFileSync('data/mod-log.json', JSON.stringify({
            log: this.log
        }));
        console.log('Saved moderation log');
    },
    getLast: function (count, filter) {
        var retrieved = 0;
        var slice = [];
        for (var i = this.log.length - 1; i >= 0; i--) {
            if (!filter || this.log[i].type === filter) {
                slice.push(this.log[i]);
                if (++retrieved === count) {
                    break;
                }
            }
        }
        return slice;
    },

    timestamp: function () {
        return (new Date()).toISOString();
    },

    logBan: function (mod, IP, aliases, reason) {
        this.save();
    },
    logUnban: function (mod, IP) {
        this.save();
    },
    logKick: function (mod, IP, aliases, reason) {
        this.save();
    },
    logMove: function (mod, nick, oldRoom, newRoom, state) {
        this.save();
    },
    logBroadcast: function (mod, msg) {
        this.save();
    },
    logBitsChange: function (mod, nick, amount, oldBalance, newBalance, state) {
        this.save();
    }
};

modLogger.init();

function doRoomChange(roomName, user) {
    var room;

    if (roomManager.has(roomName)) {
        room = roomManager.get(roomName);
    } else if (roomName.substr(0, 6) === 'house ') {
        room = User.getHouse(roomName.substr(6));
    } else {
        room = {
            type: 'ephemeral',
            name: roomName
        };
    }

    var oldRoom = user.room;

    // don't if in null room (lobby)
    if (oldRoom !== null) {
        // tell clients in old room that client has left
        User.forEach(function (iterUser) {
            if (iterUser.room === oldRoom && iterUser.nick !== user.nick) {
                iterUser.send({
                    type: 'die',
                    nick: user.nick
                });
            }
        });
        // decrease user count of old room
        if (roomManager.has(oldRoom)) {
            roomManager.get(oldRoom).user_count--;
        } else if (oldRoom.substr(0, 6) !== 'house ') {
            roomManager.onEphemeralLeave(oldRoom);
        }
    }

    // set current room to new room
    user.room = room.name;

    // tell client it has changed room and tell room details
    user.send({
        type: 'room_change',
        data: room
    });

    // bounds check position
    user.obj = sanitisePosition(user.obj, user.room);

    User.forEach(function (iterUser) {
        if (iterUser.room === user.room) {
            if (iterUser.nick !== user.nick) {
                // tell client about other clients in room
                user.send({
                    type: 'appear',
                    obj: iterUser.obj,
                    nick: iterUser.nick,
                    special: iterUser.special
                });
                // tell other clients in room about client
                iterUser.send({
                    type: 'appear',
                    obj: user.obj,
                    nick: user.nick,
                    special: user.special
                });
            }
        }
    });

    // increase user count of new room
    if (roomManager.has(room.name)) {
        room.user_count++;
    } else if (room.name.substr(0, 6) !== 'house ') {
        roomManager.onEphemeralJoin(room.name);
    }

    // tell client about room list & user count
    user.send({
        type: 'room_list',
        list: roomManager.getList(),
        user_count: User.userCount
    });
}

function handleCommand(cmd, myNick, user) {
    function sendLine(line, nick) {
        nick = nick || myNick;
        User.get(nick).send({
            type: 'console_msg',
            msg: line
        });
    }
    function sendMultiLine(lines) {
        for (var i = 0; i < lines.length; i++) {
            sendLine(lines[i]);
        }
    }

    var isMod = User.isModerator(myNick);
    var haveHouse = User.hasAccount(myNick);

    // help
    if (cmd.substr(0, 4) === 'help') {
        sendMultiLine([
            'Comandos disponibles: 1) profile, 2) list, 3) join',
            "1. profile - Muestra el perfil de alguien, ej. /profile alguien",
            '2. list - Una lista de todas las salas, ej. /list',
            "3. join - Entra en una sala, ej. /join library - Si la sala no existe, crear&aacute; una sala ephemeral  - tambi&eacute;n puedes entrar en casas de otros, ej. /join house nombre"
        ]);
        if (haveHouse) {
            sendMultiLine([
                'Comandos disponibles para casas: 1) empty, 2) lock, 3) unlock',
                '1. empty - Echa a todas las personas de tu sala, exepto tu, ej. /empty',
                '2. lock - Impide a todos entrar a tu sala, ej. /lock',
                '3. unlock - Deja que otras personas puedan entrar a tu casa de nueov, ej. /unlock'
            ]);
        }
        if (isMod) {
            sendLine('Tambi&eacute;en Mira: /modhelp');
        }
    // profile
    } else if (cmd.substr(0, 8) === 'profile ') {
        var nick = cmd.substr(8);
        if (!!nick.match(validNickRegex)) {
            user.send({
                type: 'profile',
                data: User.getProfile(nick),
                moderator_mode: isMod
            });
        } else {
            sendLine('"' + nick + '" is not a valid nickname.');
        }
    // join room
    } else if (cmd.substr(0, 5) === 'join ') {
        var roomName = cmd.substr(5);

        if (roomName.indexOf(' ') !== -1) {
            if (roomName.substr(0, 6) === 'house ') {
                var houseName = roomName.substr(6);
                if (User.hasAccount(houseName)) {
                    if (User.isHouseLocked(houseName) && myNick !== houseName) {
                        sendLine('Esta sala esta bloqueada.');
                    } else {
                        doRoomChange(roomName, user);
                    }
                } else {
                    sendLine('El usuario "' + houseName + '" no tiene una casa.');
                }
            } else {
                sendLine('Las salas no pueden contener espacios.');
            }
        } else {
            doRoomChange(roomName, user);
        }
    // list rooms
    } else if (cmd.substr(0, 4) === 'list') {
        var roomList = roomManager.getList(), roomNames = [];
        for (var i = 0; i < roomList.length; i++) {
            if (roomList[i].type !== 'ephemeral') {
                roomNames.push(roomList[i].name);
            } else {
                roomNames.push(roomList[i].name + ' (ephemeral)');
            }
        }
        sendLine(roomList.length + ' salas disponibles: ' + roomNames.join(', '));
    // empty house
    } else if (haveHouse && cmd.substr(0, 5) === 'empty') {
        var count = 0;
        User.forEach(function (iterUser) {
            if (iterUser.room === 'house ' + myNick && iterUser.nick !== myNick) {
                doRoomChange('ponyville', iterUser);
                sendLine('Has echado a: "' + iterUser.nick + '" de tu casa.');
                sendLine('El usuario "' + myNick + '" acaba de echarte de la sala.', iterUser.nick);
                count++;
            }
        });
        if (count) {
            sendLine('Echaste ' + count + ' usuarios de tu casa.');
        } else {
            sendLine('No hay nadie en tu casa.');
        }
    // lock house
    } else if (haveHouse && cmd.substr(0, 4) === 'lock') {
        var house = User.getHouse(myNick);
        if (house.locked) {
            sendLine('Tu casa est&aacute; bloqueada. Usa /unlock para desbloquearla.');
        } else {
            house.locked = true;
            User.setHouse(myNick, house);
            sendLine('Tu casa ha sido bloqueada. Usa /unlock para desbloquearla.');
        }
    // unlock house
    } else if (haveHouse && cmd.substr(0, 6) === 'unlock') {
        var house = User.getHouse(myNick);
        if (!house.locked) {
            sendLine('Tu casa est&aacute; desbloqueada. Usa /lock para bloquearla.');
        } else {
            house.locked = false;
            User.setHouse(myNick, house);
            sendLine('Tu casa ha sido desbloqueada. Usa /lock para bloquearla.');
        }
    // mod help
    } else if (isMod && cmd.substr(0, 7) === 'modhelp') {
        sendMultiLine([
            'Tus comandos de moderador son 1) kick, 2) kickban, 3) unban, 4) broadcast, 5) aliases, 6) move, 7) bits, 8) modlog',
            "1. kick & 2. kickban - kick ''echa'' del servidor a alguien ej. /kick pwni. kickban es como kick pero tambien banea permanentemente por IP. kick y kickban tambien pueden usarse con un segundo parámetro para especificar una razón, ej. /kick pwni No hagas spam en el chat!",
            '3. unban - "desbanea" la IP, ej. /unban 192.168.1.1',
            '4. broadcast - Envía un mensaje a todo el servidor, ej. /broadcast Hola a todos los ponis!',
            "5. aliases - Muestra una lista de los alias de la persona (nombres con la misma IP), ej. /aliases pwni",
            '6. move - Mueve de sala a la fuerza, ej. /move canterlot pwni',
            "7. bits - Agrega o quita bits, ej. /bits 27 rookie, /bits -27 dru",
            'También mira /help'

        ]);
    // unbanning
    } else if (isMod && cmd.substr(0, 6) === 'unban ') {
        var IP = cmd.substr(6);
        if (!banManager.isIPBanned(IP)) {
            sendLine('La IP ' + IP + ' no está "baneada".');
            return;
        }
        banManager.unbanIP(IP);
        sendLine('IP desbaneada ' + IP);
        modLogger.logUnban(myNick, IP);
    // kickbanning
    } else if (isMod && cmd.substr(0, 8) === 'kickban ') {
        var pos = cmd.indexOf(' ', 8);
        var kickee, reason = null;
        if (pos !== -1) {
            kickee = cmd.substr(8, pos-8);
            reason = cmd.substr(pos+1);
        } else {
            kickee = cmd.substr(8);
        }
        if (!User.has(kickee)) {
            sendLine('No hay ningun usuario llamado "' + kickee + '"');
            return;
        }
        if (User.isModerator(kickee)) {
            sendLine('No puedes dar kickban a otros moderadores.');
            return;
        }
        var IP = User.get(kickee).conn.remoteAddress;
        banManager.addIPBan(IP);
        sendLine('IP Baneada ' + IP);
        var aliases = [];
        // Kick aliases
        User.forEach(function (iterUser) {
            if (iterUser.conn.remoteAddress === IP) {
                // kick
                iterUser.kick('ban', reason);
                console.log('Echó a "' + iterUser.nick + '" IP: ' + IP);
                sendLine('Echó a "' + iterUser.nick + '" IP: ' + IP);
                aliases.push({
                    nick: iterUser.nick,
                    room: iterUser.room,
                    state: iterUser.obj
                });
                // broadcast kickban message
                if (iterUser.room !== null) {
                    User.forEach(function (other) {
                        if (other.room === iterUser.room) {
                            other.send({
                                type: 'kickban_notice',
                                mod_nick: user.nick,
                                mod_special: user.special,
                                kickee_nick: iterUser.nick,
                                kickee_special: iterUser.special,
                                reason: reason
                            })
                        }
                    });
                }
            }
        });
        modLogger.logBan(myNick, IP, aliases, reason);
    // kicking
    } else if (isMod && cmd.substr(0, 5) === 'kick ') {
        var pos = cmd.indexOf(' ', 5);
        var kickee, reason = null;
        if (pos !== -1) {
            kickee = cmd.substr(5, pos-5);
            reason = cmd.substr(pos+1);
        } else {
            kickee = cmd.substr(5);
        }
        if (!User.has(kickee)) {
            sendLine('No hay ningun usuario llamado "' + kickee + '"');
            return;
        }
        var IP = User.get(kickee).conn.remoteAddress;
        var aliases = [];
        // Kick aliases
        User.forEach(function (iterUser) {
            if (iterUser.conn.remoteAddress === IP) {
                // kick
                iterUser.kick('kick', reason);
                console.log('Kicked alias "' + iterUser.nick + '" of user with IP ' + IP);
                sendLine('Echó a "' + iterUser.nick + '" IP: ' + IP);
                aliases.push({
                    nick: iterUser.nick,
                    room: iterUser.room,
                    state: iterUser.obj
                });
                // broadcast kick message
                if (iterUser.room !== null) {
                    User.forEach(function (other) {
                        if (other.room === iterUser.room) {
                            other.send({
                                type: 'kick_notice',
                                mod_nick: user.nick,
                                mod_special: user.special,
                                kickee_nick: iterUser.nick,
                                kickee_special: iterUser.special,
                                reason: reason
                            })
                        }
                    });
                }
            }
        });
        modLogger.logKick(myNick, IP, aliases, reason);
    // forced move
    } else if (isMod && cmd.substr(0, 5) === 'move ') {
        var pos = cmd.indexOf(' ', 5);
        if (pos !== -1) {
            var room = cmd.substr(5, pos-5);
            var movee = cmd.substr(pos+1);
            if (!User.has(movee)) {
                sendLine('No hay ningun usuario llamado "' + movee + '"');
                return;
            }
            if (User.isModerator(movee)) {
                sendLine('No puedes mover a otros moderadores.');
                return;
            }
            modLogger.logMove(myNick, movee, User.get(movee).room, room, User.get(movee).obj);
            doRoomChange(room, User.get(movee));
            sendLine('Has sido movido a la fuerza de esta sala por ' + myNick, movee);
        } else {
            sendLine('/move necesita una sala y un nombre');
            return;
        }
    // check alias
    } else if (isMod && cmd.substr(0, 8) === 'aliases ') {
        var checked = cmd.substr(8);
        if (!User.has(checked)) {
            sendLine('No hay ningun usuario llamado "' + checked + '"');
            return;
        }
        var IP = User.get(checked).conn.remoteAddress;
        // Find aliases
        var aliasCount = 0;
        sendLine('Usuario con la IP ' + IP + ' tiene estos alias:');
        User.forEach(function (iterUser) {
            if (iterUser.conn.remoteAddress === IP) {
                sendLine((aliasCount+1) + '. Alias "' + iterUser.nick + '"');
                aliasCount++;
            }
        });
        sendLine('(' + aliasCount + ' alias totales)');
    // broadcast message
    } else if (isMod && cmd.substr(0, 10) === 'broadcast ') {
        var broadcast = cmd.substr(10);
        User.forEach(function (iterUser) {
            iterUser.send({
                type: 'broadcast',
                msg: broadcast
            });
        });
        console.log('Mensaje: "' + broadcast + '" del usuario "' + myNick + '"');
        sendLine('Mensaje enviado.');
        modLogger.logBroadcast(myNick, broadcast);
    // change bits
    } else if (isMod && cmd.substr(0, 5) === 'bits ') {
        var pos = cmd.indexOf(' ', 5);
        if (pos !== -1) {
            var amount = cmd.substr(5, pos-5);
            var receiver = cmd.substr(pos+1);
            if (!User.has(receiver)) {
                sendLine('No hay ningun usuario llamado "' + receiver + '"');
                return;
            }
            if (User.hasBits(receiver) === null) {
                sendLine('Él usuario "' + receiver + '" no tiene una cuenta.');
                return;
            }
            amount = parseInt(amount);
            if (Number.isNaN(amount) || !Number.isFinite(amount)) {
                sendLine('Cantidad no válida');
                return;
            }
            var oldBalance = User.hasBits(receiver);
            if (User.changeBits(receiver, amount)) {
                sendLine('Agregaste "' + receiver + '" bits al usuario' + amount + ' bits ');
                sendLine('¡Has recivido bits! ' + amount + ' de parte de "' + user.nick + '"', receiver);
                modLogger.logBitsChange(myNick, receiver, amount, oldBalance, User.hasBits(receiver), User.get(receiver).obj);
            } else {
                sendLine("Error al agregar bits");
            }
        } else {
            sendLine('/bits necesita una cantidad y un usuario');
            return;
        }
    // moderation log
    } else if (isMod && cmd.substr(0, 6) === 'modlog') {
        var pos = cmd.indexOf(' ', 7);
        var count, filter;
        if (pos !== -1) {
            count = cmd.substr(6, pos-6);
            filter = cmd.substr(pos+1);
        } else {
            count = cmd.substr(6);
        }
        count = parseInt(count) || 10;
        var items = modLogger.getLast(count, filter);
        sendLine('Showing ' + items.length + ' log items' + (filter ? ' filtered by type "' + filter + '"' : ''));
        user.send({
            type: 'mod_log',
            items: items
        });
    // unknown
    } else {
        sendLine('Comando desconosido.');
    }
}

var keypress = require('keypress');

keypress(process.stdin);

process.stdin.on('keypress', function (chunk, key) {
    if (key && key.name === 'u') {
        User.forEach(function (iterUser) {
            // kick for update
            iterUser.kick('update');
            console.log('Update-kicked ' + iterUser.nick);
        });
        wsServer.shutDown();
        console.log('Reiniciando el servidor.');
        process.exit();
    } else if (key && key.ctrl && key.name === 'c') {
        process.exit();
    }
});

process.stdin.setRawMode(true);
process.stdin.resume();

wsServer.on('request', function(request) {
    if (!originIsAllowed(request.origin)) {
      request.reject();
      console.log((new Date()) + ' Connection from origin ' + request.origin + ' rejected.');
      return;
    }

    // IP ban
    if (banManager.isIPBanned(request.remoteAddress)) {
        request.reject();
        console.log((new Date()) + ' Connection from banned IP ' + request.remoteAddress + ' rejected.');
        return;
    }

    try {
        var connection = request.accept('ponyplace', request.origin);
    } catch (e) {
        console.log('Caught error: ' + e);
        return;
    }
    console.log((new Date()) + ' Connection accepted from IP ' + connection.remoteAddress);

    var amConnected = true;

    // this user
    var user = null, myNick = null;

    function onMessage(message) {
        if (!amConnected) {
            return;
        }

        // handle unexpected packet types
        // we don't use binary frames
        if (message.type !== 'utf8') {
            connection.sendUTF(JSON.stringify({
                type: 'kick',
                reason: 'protocol_error'
            }));
            connection.close();
            return;
        }

        // every frame is a JSON-encoded packet
        try {
            var msg = JSON.parse(message.utf8Data);
        } catch (e) {
            connection.sendUTF(JSON.stringify({
                type: 'kick',
                reason: 'protocol_error'
            }));
            connection.close();
            return;
        }

        if (user === null) {
            connection.sendUTF(JSON.stringify({
                type: 'console_msg',
                msg: 'No estas logeado.'
            }));
            connection.close();
            return;
        }

        switch (msg.type) {
            case 'console_command':
                if (msg.hasOwnProperty('cmd')) {
                    handleCommand(msg.cmd, myNick, user);
                    return;
                }
            break;
            case 'update':
                // sanitise chat message
                if (msg.obj.hasOwnProperty('chat')) {
                    msg.obj.chat = sanitiseChat(msg.obj.chat);
                }

                // bounds check position
                if (msg.hasOwnProperty('obj')) {
                    msg.obj = sanitisePosition(msg.obj, user.room);
                }

                // check avatar
                if (msg.obj.hasOwnProperty('img_name')) {
                    if (!User.hasAvatar(user.nick, msg.obj.img_name)) {
                        user.kick('dont_have_avatar');
                        return;
                    }
                }

                // update their stored state
                user.obj = msg.obj;

                // broadcast new state to other clients in same room
                User.forEach(function (iterUser) {
                    if (iterUser.conn !== connection && iterUser.room === user.room) {
                        iterUser.send({
                            type: 'update',
                            obj: msg.obj,
                            nick: user.nick
                        });
                    }
                });
            break;
            case 'create_account':
                if (!User.hasAccount(myNick)) {
                    User.assert(msg.assertion, function (good, email) {
                        if (good) {
                            if (!User.hasEmail(email)) {
                                User.createAccount(myNick, email);
                                user.sendAccountState();
                            } else {
                                user.send({
                                    type: 'console_msg',
                                    msg: 'Email en uso.'
                                });
                            }
                        } else {
                            user.send({
                                type: 'console_msg',
                                msg: 'Algo salio mal en el login.'
                            });
                        }
                    });
                } else {
                    user.kick('protocol_error');
                }
            break;
            case 'delete_account':
                if (User.hasAccount(myNick)) {
                    User.deleteAccount(myNick);
                    user.kick('account_deleted');
                } else {
                    user.kick('protocol_error');
                }
            break;
            case 'room_change':
                if (msg.name.indexOf(' ') === -1) {
                    doRoomChange(msg.name, user);
                } else {
                    if (msg.name.substr(0, 6) === 'house ') {
                        var houseName = msg.name.substr(6);
                        if (User.hasAccount(houseName)) {
                            if (User.isHouseLocked(houseName) && myNick !== houseName) {
                                user.send({
                                    type: 'console_msg',
                                    msg: 'Esta casa esta bloqueada.'
                                });
                            } else {
                                doRoomChange(msg.name, user);
                            }
                        } else {
                            user.send({
                                type: 'console_msg',
                                msg: 'El usuario con el nick: "' + houseName + '" no tiene casa.'
                            });
                        }
                    } else {
                        user.kick('protocol_error');
                    }
                }
            break;
            case 'room_list':
                // tell client about rooms
                user.send({
                    type: 'room_list',
                    list: roomManager.getList(),
                    user_count: User.userCount
                });
            break;
            case 'profile_get':
                user.send({
                    type: 'profile',
                    data: User.getProfile(msg.nick),
                    moderator_mode: User.isModerator(myNick)
                });
            break;
            case 'priv_msg':
                if (!User.has(msg.nick)) {
                    user.send({
                        type: 'priv_msg_fail',
                        nick: msg.nick
                    });
                    return;
                } else {
                    User.get(msg.nick).send({
                        type: 'priv_msg',
                        from_nick: myNick,
                        from_special: user.special,
                        msg: msg.msg
                    });
                }
            break;
            case 'friend_add':
                if (User.hasAccount(myNick)) {
                    User.addFriend(myNick, msg.nick);
                    user.sendAccountState();
                } else {
                    user.kick('protocol_error');
                }
            break;
            case 'friend_remove':
                if (User.hasAccount(myNick)) {
                    User.removeFriend(myNick, msg.nick);
                    user.sendAccountState();
                } else {
                    user.kick('protocol_error');
                }
            break;
            case 'get_catalogue':
                user.send({
                    type: 'catalogue_content',
                    data: User.getCatalogue(msg.name)
                });
            break;
            case 'buy_from_catalogue':
                var result;
                if (result = User.buyFromCatalogue(user.nick, msg.name, msg.index)) {
                    user.send({
                        type: 'console_msg',
                        msg: 'Haz comprado "' + result.name_full + '" por ' + result.price + ' bits'
                    });
                } else {
                    user.send({
                        type: 'console_msg',
                        msg: 'Fallo la compra de este producto - seguramente no tienes suficientes bits o ya tienes el producto.'
                    });
                }
            break;
            case 'change_house_background':
                if (User.hasAccount(myNick)) {
                    var house = User.getHouse(myNick);
                    // default
                    if (msg.bg_name === null) {
                        house.background = {
                            data: '/ponyplace/media/rooms/cave.png',
                            width: 960,
                            height: 660,
                            iframe: false
                        };
                        User.setHouse(myNick, house);
                        user.send({
                            type: 'console_msg',
                            msg: 'Se ha reseteado el fondo de la casa.'
                        });
                        User.forEach(function (iterUser) {
                            if (iterUser.room === 'house ' + myNick) {
                                doRoomChange('house ' + myNick, iterUser);
                            }
                        });
                    } else {
                        if (User.hasInventoryItem(myNick, msg.bg_name)) {
                            if (User.inventoryItems.hasOwnProperty(msg.bg_name)) {
                                house.background = User.inventoryItems[msg.bg_name].background_data;
                                User.setHouse(myNick, house);
                                user.send({
                                    type: 'console_msg',
                                    msg: 'Background de la casa cambiado.'
                                });
                                User.forEach(function (iterUser) {
                                    if (iterUser.room === 'house ' + myNick) {
                                        doRoomChange('house ' + myNick, iterUser);
                                    }
                                });
                            } else {
                                user.kick('protocol_error');
                            }
                        } else {
                            user.kick('dont_have_item');
                        }
                    }
                } else {
                    user.kick('protocol_error');
                }
            break;
            // handle unexpected packet types
            default:
                user.kick('protocol_error');
            break;
        }
    }

    function completeRequest(nick, msg) {
        if (!amConnected) {
            return;
        }

        // Prevent nickname dupe
        if (User.has(nick)) {
            connection.sendUTF(JSON.stringify({
                type: 'kick',
                reason: 'nick_in_use'
            }));
            connection.close();
            return;
        }

        // sanitise chat message
        if (msg.obj.hasOwnProperty('chat')) {
            msg.obj.chat = sanitiseChat(msg.obj.chat);
        }

        // check avatar
        if (msg.obj.hasOwnProperty('img_name')) {
            if (!User.hasAvatar(nick, msg.obj.img_name)) {
                msg.obj.img_name = 'derpy';
                msg.obj.img_index = 0;
                connection.sendUTF(JSON.stringify({
                    type: 'avatar_change',
                    img_name: msg.obj.img_name,
                    img_index: msg.obj.img_index
                }));
            }
        }

        // tell client about rooms
        connection.sendUTF(JSON.stringify({
            type: 'room_list',
            list: roomManager.getList(),
            user_count: User.userCount
        }));

        // tell client about avatars
        connection.sendUTF(JSON.stringify({
            type: 'avatar_list',
            list: User.avatars
        }));

        // tell client about inventory items
        connection.sendUTF(JSON.stringify({
            type: 'inventory_item_list',
            list: User.inventoryItems
        }));

        myNick = nick;
        user = new User(nick, connection, msg.obj, null);
        user.sendAccountState();

        // give daily reward
        if (User.hasAccount(nick)) {
            var date = (new Date()).toISOString().split('T', 1)[0];
            if (User.getUserData(nick, 'last_reward', '1970-01-01') !== date) {
                if (User.hasBits(nick) < 500) {
                    var reward = Math.floor(Math.random()*100);
                    if (User.changeBits(nick, reward)) {
                        User.setUserData(nick, 'last_reward', date);
                        user.send({
                            type: 'console_msg',
                            msg: "Como un agradecimiento por visitar ponyplace hoy, te regalamos " + reward + " bits gratis! :)"
                        });
                    } else {
                        user.send({
                            type: 'console_msg',
                            msg: 'Sorry, something went wrong. Giving you your daily reward failed :('
                        });
                    }
                } else {
                    user.send({
                        type: 'console_msg',
                        msg: "Perdona, pero solo recives bits diarios si tienes menos de 500 bits. :("
                    });
                }
            }
        }

        console.log((new Date()) + ' User with nick: "' + myNick + '" connected.');
    }

    // Deals with first message
    connection.once('message', function(message) {
        if (!amConnected) {
            return;
        }

        // handle unexpected packet types
        // we don't use binary frames
        if (message.type !== 'utf8') {
            connection.sendUTF(JSON.stringify({
                type: 'kick',
                reason: 'protocol_error'
            }));
            connection.close();
            return;
        }

        // every frame is a JSON-encoded packet
        try {
            var msg = JSON.parse(message.utf8Data);
        } catch (e) {
            connection.sendUTF(JSON.stringify({
                type: 'kick',
                reason: 'protocol_error'
            }));
            connection.close();
            return;
        }

        // We're expecting an appear packet first
        // Anything else is unexpected
        if (msg.type !== 'appear') {
            connection.sendUTF(JSON.stringify({
                type: 'kick',
                reason: 'protocol_error'
            }));
            connection.close();
            return;
        }

        if (!msg.authenticated) {
            // Prevent nickname stealing
            if (User.hasAccount(msg.nick)) {
                connection.sendUTF(JSON.stringify({
                    type: 'kick',
                    reason: 'protected_nick'
                }));
                connection.close();
                return;
            // Prefent profane/long/short/additional whitespace nicks
            } else if ((!!msg.nick.match(badRegex)) || msg.nick.length > 18 || msg.nick.length < 3 || !msg.nick.match(validNickRegex)) {
                connection.sendUTF(JSON.stringify({
                    type: 'kick',
                    reason: 'bad_nick'
                }));
                connection.close();
                return;
            }
            completeRequest(msg.nick, msg);
        } else {
            if (msg.hasOwnProperty('bypass') && msg.bypass) {
                if (User.checkBypass(msg.nick, msg.bypass)) {
                    completeRequest(msg.nick, msg);
                } else {
                    connection.sendUTF(JSON.stringify({
                        type: 'kick',
                        reason: 'bad_login'
                    }));
                    connection.close();
                }
            } else {
                User.assert(msg.assertion, function (good, email) {
                    var nick;
                    if (good) {
                        if (nick = User.getAccountForEmail(email)) {
                            completeRequest(nick, msg);
                        } else {
                            connection.sendUTF(JSON.stringify({
                                type: 'kick',
                                reason: 'no_assoc_account'
                            }));
                            connection.close();
                        }
                    } else {
                        connection.sendUTF(JSON.stringify({
                            type: 'kick',
                            reason: 'bad_login'
                        }));
                        connection.close();
                    }
                });
            }
        }

        // call onMessage for subsequent messages
        connection.on('message', onMessage);
    });

    connection.on('close', function(reasonCode, description) {
        amConnected = false;
        console.log((new Date()) + ' Peer ' + connection.remoteAddress + ' disconnected.');
        if (user !== null && User.has(myNick)) {
            // remove from users map
            user.kill();

            // don't if in null room (lobby)
            if (user.room !== null) {
                // broadcast user leave to other clients
                User.forEach(function (iterUser) {
                    if (iterUser.room === user.room) {
                        iterUser.send({
                            type: 'die',
                            nick: user.nick
                        });

                    }
                });
                // decrease user count of room
                if (roomManager.has(user.room)) {
                    roomManager.get(user.room).user_count--;
                } else if (user.room.substr(0, 6) !== 'house '){
                    roomManager.onEphemeralLeave(user.room);
                }
            }
        }
    });
});
