// based on https://github.com/benediktarnold/owfs
var net = require('net');

var OW_READ =   2; // read from 1-wire bus
var OW_WRITE =  3; // write to 1-wire bus
var OW_DIR =    4; // list 1-wire bus
var OW_PRESENT = 6; // Is the specified component recognized and known
var OW_DIRALL = 7; // list 1-wire bus, in one packet string
var OW_GET =    8; // dirall or read depending on path
var OW_DIRALLSLASH = 9; // dirall but with directory entries getting a trailing '/'
var OW_GETSLASH = 10; // dirallslash or read depending on path


function Client(options) {
    var self = this;

    self.headers = ['version', 'payload', 'ret', 'controlflags', 'size', 'offset'];

    self.option = {
        host: 'localhost',
        port: 4304,
    }

// set options
    for(var i in options) {
        if(typeof(options[i]) == 'object') {
            self.option[i] = {};
            for(var j in options[i]) {
                self.option[i][j] = options[i][j];
            }
        } else {
            self.option[i] = options[i];
        }
    }

// define procedures
    self.htonl = function(n) {
        return [
            (n & 0xFF000000) >>> 24,
            (n & 0x00FF0000) >>> 16,
            (n & 0x0000FF00) >>>  8,
            (n & 0x000000FF) >>>  0,
        ];
    }

    self.ntohl = function(b) {
      return ((0xff & b[0]) << 24) |
             ((0xff & b[1]) << 16) |
             ((0xff & b[2]) << 8) |
             ((0xff & b[3]));
    }

    // send raw data to 1-wire and return result
    self.send = function(path, value, type, callback, err) {
        var socket = new net.Socket({ type: 'tcp4' });
        var messages = [];

        socket.on('error', function(error) {
            throw new Error(error);
        });

        socket.on('end', function() {
            callback(messages);
        });

        socket.on('data', function (data) {
            var j=0, chunk = 4, header ={};
            for (var i=0; i<24; i+=chunk) {
                var temparray = data.slice(i,i+chunk);
                var value = self.ntohl(temparray);
                header[self.headers[j]] = value;
                j++;
            }
            messages.push({
                header: header,
                payload: data.slice(24).toString('utf8')
            });
        });

        socket.connect(self.option.port, self.option.host, function() {
            var msg = [];
            path += '\x00';
            value = (type == OW_WRITE) ? value.toString() + '\x00' : '' ;
            // http://owfs.org/index.php?page=owserver-message-types
            msg = msg.concat(
                self.htonl(0),
                self.htonl(path.length + value.length),
                self.htonl(type),
                self.htonl(0x00000020),
                self.htonl(value.length ? value.length : 8192),
                self.htonl(0)
            );
            var buf = new Buffer(msg.length + path.length + value.length);
            new Buffer(msg).copy(buf, 0);
            new Buffer(path + value).copy(buf, msg.length);

            socket.end(buf);
        });
    }

    // return array of dir
    self.list = function(path, callback, error) {
        self.send(path, null, OW_DIRALL, function(data) {
            // if(data[0].header.ret < 0) return self.emit('error', data[0].header.ret);
            if(data[0].header.ret < 0) return error(data[0].header.ret);
            var str = data[0].payload;
            str = str.substring(0, str.length - 1); // remove zero-char from end
            callback(str.split(','));
        });
    }

    // read value
    self.read = function(path, callback, error) {
        self.send(path, null, OW_READ, function(data) {
            // if(data[0].header.ret < 0) return self.emit('error', data[0].header.ret);
            if(data[0].header.ret < 0) return error(data[0].header.ret);
            callback(data[0].payload);
        });
    }

    // write value
    self.write = function(path, value, callback, error) {
        self.send(path, value, OW_WRITE, function(data) {
            console.log(data)
            // if(data[0].header.ret < 0) return self.emit('error', data[0].header.ret);
            if(data[0].header.ret < 0) return error(data[0].header.ret);
            callback();
        });
    }

}

exports.Client = Client;