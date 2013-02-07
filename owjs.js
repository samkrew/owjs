var events = require('events');
var util = require('util');
var net = require('net');
var async = require('async');

var OW_READ =   2; // read from 1-wire bus
var OW_WRITE =  3; // write to 1-wire bus
var OW_DIR =    4; // list 1-wire bus
var OW_PRESENT = 6; // Is the specified component recognized and known
var OW_DIRALL = 7; // list 1-wire bus, in one packet string
var OW_GET =    8; // dirall or read depending on path
var OW_DIRALLSLASH = 9; // dirall but with directory entries getting a trailing '/'
var OW_GETSLASH = 10; // dirallslash or read depending on path


function Client(host, port) {
    var self = this;
    self.host = host || 'localhost';
    self.port = port || 4304;
    self.headers = ['version', 'payload', 'ret', 'controlflags', 'size', 'offset'];

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
    self.send = function(path, funс, callback) {
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

            var buf = new Buffer(msg.length + len + 1);
            new Buffer(msg).copy(buf, 0);
            new Buffer(path+'\x00').copy(buf, msg.length);

            socket.end(buf);
        });
    }

    // return array of dir or error code
    self.dir = function(path, callback, err) {
        self.send(path, OW_DIRALL, function(data) {
            if(data[0].header.ret < 0) return err(data[0].header.ret);
            var str = data[0].payload;
            str = str.substring(0, str.length - 1); // remove zero-char from end
            callback(str.split(','));
        });
    }

    // read value
    self.get = function(path, callback, err) {
        self.send(path, OW_READ, function(data) {
            if(data[0].header.ret < 0) return err(data[0].header.ret);
            callback(data[0].payload);
        });
    }

    // write value
    self.set = function(path, value, callback, err) {
        self.send(path+'\u0000'+value, OW_WRITE, function(data) {
            console.log(data)
            if(data[0].header.ret < 0) return err(data[0].header.ret);
            callback(data[0].payload.split(','));
        });
    }


    // read cache settings
    async.parallel({
        one: function(callback) {
            self.get('/05.4AEC29CDBAAB/PIO',
                function(data) {
                    // console.log(data)
                    err;
                    self.set('/10.67C6697351FF/temphigh',
                        1,
                        function(data) {
                            console.log(data)
                            self.get('/05.4AEC29CDBAAB/PIO',
                                function(data) {
                                    console.log(data)
                                },
                                function(error) {
                                    console.log('err3')
                                }
                            );

                        },
                        function(error) {
                            console.log('err2')
                        }
                    );
                },
                function(error) {
                    console.log('err1')
                }
            );
        },
        two: function(callback){
            setTimeout(function(){
                callback(null, 2);
            }, 100);
        }
    },
    function(err, results) {
        if(err) throw new Error(error);
        self.emit('ready');
    });
}


// Client.prototype.dir = function(path, callback) {
//     self.send(path, OW_DIR, function(data) {
//         console.log(data)
//     });
// }

// console.log(Client.test);



util.inherits(Client, events.EventEmitter);


exports.Client = Client;

exports.OW_READ = OW_READ;
exports.OW_WRITE = OW_WRITE;
exports.OW_DIR = OW_DIR;
exports.OW_PRESENT = OW_PRESENT;
exports.OW_DIRALL = OW_DIRALL;
exports.OW_GET = OW_GET;
exports.OW_DIRALLSLASH = OW_DIRALLSLASH;
exports.OW_GETSLASH = OW_GETSLASH;