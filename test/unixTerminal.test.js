if (process.platform === 'win32') return

var assert = require("assert");
var pollUntil = require('pollUntil');
var tty = require('tty');
var UnixTerminal = require('../lib/unixTerminal').UnixTerminal;

describe("UnixTerminal", function() {
  describe("Constructor", function() {
    it("should set a valid pts name", function() {
      const term = new UnixTerminal('/bin/bash', [], {});
      let regExp;
      if (process.platform === 'linux') {
        // https://linux.die.net/man/4/pts
        regExp = /^\/dev\/pts\/\d+$/;
      }
      if (process.platform === 'darwin') {
        // https://developer.apple.com/legacy/library/documentation/Darwin/Reference/ManPages/man4/pty.4.html
        regExp = /^\/dev\/tty[p-sP-S][a-z0-9]+$/;
      }
      if (regExp) {
        assert.ok(regExp.test(term._pty), '"' + term._pty + '" should match ' + regExp.toString());
      }
    });
  });

  describe("PtyForkEncodingOption", function() {
    it("should default to utf8", function(done) {
      const term = new UnixTerminal(null, [ '-c', 'cat "' + __dirname + '/utf8-character.txt"' ]);
      term.on('data', function(data) {
        assert.equal(typeof data, 'string');
        assert.equal(data, '\u00E6');
        done();
      });
    });
    it("should return a Buffer when encoding is null", function(done) {
      const term = new UnixTerminal(null, [ '-c', 'cat "' + __dirname + '/utf8-character.txt"' ], {
        encoding: null,
      });
      term.on('data', function(data) {
        assert.equal(typeof data, 'object');
        assert.ok(data instanceof Buffer);
        assert.equal(0xC3, data[0]);
        assert.equal(0xA6, data[1]);
        done();
      });
    });
    it("should support other encodings", function(done) {
      const text = 'test æ!';
      const term = new UnixTerminal(null, ['-c', 'echo "' + text + '"'], {
        encoding: 'base64'
      });
      let buffer = '';
      term.on('data', function(data) {
        assert.equal(typeof data, 'string');
        buffer += data;
      });
      term.on('exit', function() {
        assert.equal(new Buffer(buffer, 'base64').toString().replace('\r', '').replace('\n', ''), text);
        done();
      });
    });
  });

  describe('open', function() {
    var term;

    afterEach(function() {
      if (term) {
        term.slave.destroy();
        term.master.destroy();
      }
    });

    it("should open a pty with access to a master and slave socket", function(done) {
      term = UnixTerminal.open();

      assert(tty.isatty(term.master));
      assert(tty.isatty(term.slave));

      var slavebuf = '';
      term.slave.on('data', function(data) {
        slavebuf += data;
      });

      var masterbuf = '';
      term.master.on('data', function(data) {
        masterbuf += data;
      });

      pollUntil(() => {
        if (masterbuf === "slave\r\nmaster\r\n" && slavebuf === "master\n") {
          done();
        }
      }, [], 200, 10);

      term.slave.write("slave\n");
      term.master.write("master\n");
    });
  });
});
