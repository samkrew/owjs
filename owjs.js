var net = require('net');

var OW_READ =   2; // read from 1-wire bus
var OW_WRITE =  3; // write to 1-wire bus
var OW_DIR =    4; // list 1-wire bus
var OW_PRESENT = 6; // Is the specified component recognized and known
var OW_DIRALL = 7; // list 1-wire bus, in one packet string
var OW_GET =    8; // dirall or read depending on path
var OW_DIRALLSLASH = 9; // dirall but with directory entries getting a trailing '/'
var OW_GETSLASH = 10; // dirallslash or read depending on path


function Client(host, port) {
    this.host = host || 'localhost';
    this.port = port || 4304;
    this.headers = ['version', 'payload', 'ret', 'controlflags', 'size', 'offset'];
    self = this;

    this.htonl = function(n) {
        return [
            (n & 0xFF000000) >>> 24,
            (n & 0x00FF0000) >>> 16,
            (n & 0x0000FF00) >>>  8,
            (n & 0x000000FF) >>>  0,
        ];
    }

    this.ntohl = function(b) {
      return ((0xff & b[0]) << 24) |
             ((0xff & b[1]) << 16) |
             ((0xff & b[2]) << 8) |
             ((0xff & b[3]));
    }
}

Client.prototype.send = function(path, funс, callback) {
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

    socket.connect(self.port, self.host, function() {
        var msg = [], len = path.length + 1;

        msg = msg.concat(
            self.htonl(0), //version
            self.htonl(len), //payload length
            self.htonl(funс), //type of function call -> http://owfs.org/index.php?page=owserver-message-types
            self.htonl(0x00000020), //format flags -- 266 for alias upport
            self.htonl(8192), //size of data element for read or write
            self.htonl(0)
        );

        var buf = new Buffer(msg.length + len);
        new Buffer(msg).copy(buf, 0);
        new Buffer(path+'\x00').copy(buf, msg.length);

        socket.end(buf);
    });
}

exports.Client = Client;

exports.OW_READ = OW_READ;
exports.OW_WRITE = OW_WRITE;
exports.OW_DIR = OW_DIR;
exports.OW_PRESENT = OW_PRESENT;
exports.OW_DIRALL = OW_DIRALL;
exports.OW_GET = OW_GET;
exports.OW_DIRALLSLASH = OW_DIRALLSLASH;
exports.OW_GETSLASH = OW_GETSLASH;