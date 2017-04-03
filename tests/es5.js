var BlockAndLogStreamer = require("../source/index").BlockAndLogStreamer;
var getBLockByHashFactory = require("./helpers").getBlockByHashFactory;
var getLogsFactory = require("./helpers").getLogsFactory;
var MockBlock = require("./helpers").MockBlock;
var MockLog = require("./helpers").MockLog;
var getBlockByHashFactory = require("./helpers").getBlockByHashFactory;
var getLogsFactory = require("./helpers").getLogsFactory;
var expect = require("chai").expect;

describe("BlockAndLogStreamer Callback Style", function () {
  var blockAndLogStreamer;
  var blockAddedAnnouncements;
  var blockRemovedAnnouncements;
  var logAddedAnnouncements;
  var logRemovedAnnouncements;
  var onBlockAdded = (block) => blockAddedAnnouncements.push(block);
  var onBlockRemoved = (block) => blockRemovedAnnouncements.push(block);
  var onLogAdded = (log) => logAddedAnnouncements.push(log);
  var onLogRemoved = (log) => logRemovedAnnouncements.push(log);

  beforeEach(() => {
    var getBlockByHash = getBlockByHashFactory();
    wrappedGetBlockByHash = function (hash, callback) {
      getBlockByHash(hash)
        .then(block => callback(undefined, block))
        .catch(error => callback(error, undefined));
    };
    var getLogs = getLogsFactory(1);
    wrappedGetLogs = function (filters, callback) {
      getLogs(filters)
        .then(logs => callback(undefined, logs))
        .catch(error => callback(error, undefined));
    };
    blockAndLogStreamer = BlockAndLogStreamer.createCallbackStyle(wrappedGetBlockByHash, wrappedGetLogs, { blockRetention: 5 });
		blockAndLogStreamer.addLogFilter({});
    blockAndLogStreamer.subscribeToOnBlockAdded(onBlockAdded);
    blockAndLogStreamer.subscribeToOnBlockRemoved(onBlockRemoved);
    blockAndLogStreamer.subscribeToOnLogAdded(onLogAdded);
    blockAndLogStreamer.subscribeToOnLogRemoved(onLogRemoved);
    blockAddedAnnouncements = [];
    blockRemovedAnnouncements = [];
    logAddedAnnouncements = [];
    logRemovedAnnouncements = [];
  });

  it("announces new blocks and logs", function (done) {
    blockAndLogStreamer.reconcileNewBlockCallbackStyle(new MockBlock(0x7777), function (error) {
      expect(error).to.be.undefined;
      expect(blockAddedAnnouncements).to.deep.equal([new MockBlock(0x7777)]);
      expect(blockRemovedAnnouncements).to.deep.equal([]);
      expect(logAddedAnnouncements).to.deep.equal([new MockLog(0x7777, 0)]);
      expect(logRemovedAnnouncements).to.deep.equal([]);
      done();
    });
  });

  it("announces removed blocks and logs", function (done) {
    blockAndLogStreamer.reconcileNewBlockCallbackStyle(new MockBlock(0x7777, "AAAA"), function (error) {
      expect(error).to.be.undefined;
      blockAndLogStreamer.reconcileNewBlockCallbackStyle(new MockBlock(0x7778, "AAAA"), function (error) {
        expect(error).to.be.undefined;
        blockAddedAnnouncements = [];
        blockRemovedAnnouncements = [];
        logAddedAnnouncements = [];
        logRemovedAnnouncements = [];

        blockAndLogStreamer.reconcileNewBlockCallbackStyle(new MockBlock(0x7778, "BBBB", "AAAA"), function (error) {
          expect(error).to.be.undefined;
          expect(blockAddedAnnouncements).to.deep.equal([new MockBlock(0x7778, "BBBB", "AAAA")]);
          expect(blockRemovedAnnouncements).to.deep.equal([new MockBlock(0x7778, "AAAA", "AAAA")]);
          expect(logAddedAnnouncements).to.deep.equal([new MockLog(0x7778, 0)]);
          expect(logRemovedAnnouncements).to.deep.equal([new MockLog(0x7778, 0)]);
          done();
        });
      });
    });
  });

  it("latest block is latest fully reconciled block", function (done) {
    blockAndLogStreamer.reconcileNewBlockCallbackStyle(new MockBlock(0x7777), function (error) {
      expect(error).to.be.undefined;
      const promise = blockAndLogStreamer.reconcileNewBlockCallbackStyle(new MockBlock(0x7779), function (error) {
        expect(error).to.be.undefined;
        expect(blockAndLogStreamer.getLatestReconciledBlock()).to.deep.equal(new MockBlock(0x7779));
        done();
      });

      expect(blockAndLogStreamer.getLatestReconciledBlock()).to.deep.equal(new MockBlock(0x7777));
    });
  });

  it("adding multiple blocks in quick succession results in expected callbacks", function (done) {
    blockAndLogStreamer.reconcileNewBlockCallbackStyle(new MockBlock(0x7777, "AAAA", "AAAA"), function (error) { expect(error).to.be.undefined; });
    blockAndLogStreamer.reconcileNewBlockCallbackStyle(new MockBlock(0x7779, "AAAA", "AAAA"), function (error) { expect(error).to.be.undefined; });
    blockAndLogStreamer.reconcileNewBlockCallbackStyle(new MockBlock(0x7779, "BBBB", "AAAA"), function (error) {
      expect(error).to.be.undefined;
      expect(blockAddedAnnouncements).to.deep.equal([
        new MockBlock(0x7777, "AAAA", "AAAA"),
        new MockBlock(0x7778, "AAAA", "AAAA"),
        new MockBlock(0x7779, "AAAA", "AAAA"),
        new MockBlock(0x7779, "BBBB", "AAAA"),
      ]);
      expect(blockRemovedAnnouncements).to.deep.equal([
        new MockBlock(0x7779, "AAAA", "AAAA"),
      ]);
      expect(logAddedAnnouncements).to.deep.equal([
        new MockLog(0x7777, 0),
        new MockLog(0x7778, 0),
        new MockLog(0x7779, 0),
        new MockLog(0x7779, 0),
      ]);
      expect(logRemovedAnnouncements).to.deep.equal([
        new MockLog(0x7779, 0),
      ]);
      done();
    });
  });
});
