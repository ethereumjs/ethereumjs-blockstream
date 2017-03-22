
var reconcileBlockHistory = require("../source/callback-style-wrappers").reconcileBlockHistoryWithCallback;
var reconcileBlocksAndLogs = require("../source/callback-style-wrappers").reconcileBlocksAndLogsWithCallback;
var MockBlock = require("./helpers").MockBlock;
var MockLog = require("./helpers").MockLog;
var getBlockByHashFactory = require("./helpers").getBlockByHashFactory;
var getLogsFactory = require("./helpers").getLogsFactory;
var expect = require("chai").expect;
var ImmutableList = require("immutable").List;

describe("reconcileBlockHistoryEs5", function () {
  var newBlockAnnouncements;
  var blockRemovalAnnouncments;
  function onBlockAdded(block, callback) { setTimeout(function () { newBlockAnnouncements.push(block); callback(); }); }
  function onBlockRemoved(block, callback) { setTimeout(function () { blockRemovalAnnouncments.push(block); callback(); }); }

  beforeEach(() => {
    newBlockAnnouncements = [];
    blockRemovalAnnouncments = [];
  });

  it("fires callback with new block history", function (done) {
    var oldHistory = null;
    var newBlock = new MockBlock(0x7777);

    reconcileBlockHistory(function (hash) { throw new Error("Unexpected callback."); }, oldHistory, newBlock, onBlockAdded, onBlockRemoved, 100, function (error, newHistory) {
      expect(error).to.be.undefined;
      expect(newHistory.toJS()).to.deep.equal([newBlock]);
      expect(newBlockAnnouncements).to.deep.include(newBlock);
      expect(blockRemovalAnnouncments).to.be.empty;
      done();
    });
  });

  it("accepts a getBlockByHash function that uses a callback", function (done) {
    var oldHistory = ImmutableList([
      new MockBlock(0x7777),
      new MockBlock(0x7778),
    ]);
    var newBlock = new MockBlock(0x777B);
    var getBlockByHash = getBlockByHashFactory();
    var wrappedGetBlockByHash = function (hash, callback) {
      return getBlockByHash(hash).then(function (block) {
        callback(null, block);
      });
    };

    reconcileBlockHistory(wrappedGetBlockByHash, oldHistory, newBlock, onBlockAdded, onBlockRemoved, 100, function (error, newHistory) {
      expect(newHistory.toJS()).to.deep.equal([
        new MockBlock(0x7777),
        new MockBlock(0x7778),
        new MockBlock(0x7779),
        new MockBlock(0x777A),
        new MockBlock(0x777B),
      ]);
      expect(newBlockAnnouncements).to.deep.equal([
        new MockBlock(0x7779),
        new MockBlock(0x777A),
        new MockBlock(0x777B),
      ]);
      expect(blockRemovalAnnouncments).to.be.empty;
      done();
    });
  });

  it("correctly rejects when getBlockByHash calls back with error", function (done) {
    var getBlockByHash = function (hash, callback) { callback(new Error("apple")); }
    var blockHistory = ImmutableList([new MockBlock(0x7777)]);
    var newBlock = new MockBlock(0x7779);
    var blockRetention = 5;

    reconcileBlockHistory(getBlockByHash, blockHistory, newBlock, onBlockAdded, onBlockRemoved, blockRetention, function (error, newHistory) {
      expect(error).to.be.an("error");
      expect(error.message).to.equal("apple");
      done();
    });
  });

  it("correctly rejects when getBlockByHash throws", function (done) {
    var getBlockByHash = function (hash, callback) {
      throw new Error("apple");
    }
    var blockHistory = ImmutableList([new MockBlock(0x7777)]);
    var newBlock = new MockBlock(0x7779);
    var blockRetention = 5;

    reconcileBlockHistory(getBlockByHash, blockHistory, newBlock, onBlockAdded, onBlockRemoved, blockRetention, function (error, newHistory) {
      expect(error).to.be.an("error");
      expect(error.message).to.equal("apple");
      done();
    });
  });

  it("correctly rejects when onBlockAdded calls back with error", function (done) {
    var getBlockByHash = function (hash, callback) { throw new Error("unreachable"); }
    var failingOnBlockAdded = function (block, callback) { callback(new Error("apple")); }
    var blockHistory = null;
    var newBlock = new MockBlock(0x7777);
    var blockRetention = 5;

    reconcileBlockHistory(getBlockByHash, blockHistory, newBlock, failingOnBlockAdded, onBlockRemoved, blockRetention, function (error, newHistory) {
      expect(error).to.be.an("error");
      expect(error.message).to.equal("apple");
      done();
    });
  });

  it("accepts onBlockRemoved function that uses a callback", function (done) {
    var getBlockByHash = getBlockByHashFactory();
    var getBlockByHash = function (hash, callback) { throw new Error("unreachable"); }
    var blockHistory = ImmutableList([
      new MockBlock(0x7777, "AAAA", "AAAA"),
      new MockBlock(0x7778, "AAAA", "AAAA"),
    ]);
    var newBlock = new MockBlock(0x7778, "BBBB", "AAAA");
    var blockRetention = 5;

    reconcileBlockHistory(getBlockByHash, blockHistory, newBlock, onBlockAdded, onBlockRemoved, blockRetention, function (error, newHistory) {
      expect(error).to.be.undefined;
      expect(newHistory.toJS()).to.deep.equal([
        new MockBlock(0x7777, "AAAA", "AAAA"),
        new MockBlock(0x7778, "BBBB", "AAAA"),
      ]);
      expect(newBlockAnnouncements).to.deep.equal([new MockBlock(0x7778, "BBBB", "AAAA")]);
      expect(blockRemovalAnnouncments).to.deep.equal([new MockBlock(0x7778, "AAAA", "AAAA")]);
      done();
    });
  });
});

describe("reconcileBlocksAndLogsEs5", function () {
  var logAddedAnnonucements;
  var logRemovedAnnouncements;
  function onLogAdded(block, callback) { setTimeout(function () { logAddedAnnonucements.push(block); callback(); }); }
  function onLogRemoved(block, callback) { setTimeout(function () { logRemovedAnnouncements.push(block); callback(); }); }

  beforeEach(() => {
    logAddedAnnonucements = [];
    logRemovedAnnouncements = [];
  });

  it("generally works", function (done) {
    var getBlockByHash = getBlockByHashFactory([new MockBlock(0x7778, "BBBB", "AAAA")]);
    var wrappedGetBlockByHash = function (hash, callback) {
      return getBlockByHash(hash).then(function (block) {
        callback(null, block);
      });
    };
    var getLogs = getLogsFactory(2, "BBBB");
    var wrappedGetLogs = function (filterOptions, callback) {
      return getLogs(filterOptions).then(function (logs) {
        callback(null, logs);
      });
    };
    var newHistory = {
      blockHistory: ImmutableList([
        new MockBlock(0x7777, "AAAA", "AAAA"),
        new MockBlock(0x7778, "AAAA", "AAAA"),
        new MockBlock(0x7779, "AAAA", "AAAA"),
      ]), logHistory: ImmutableList([
        new MockLog(0x7777, 0x0, "AAAA"),
        new MockLog(0x7777, 0x1, "AAAA"),
        new MockLog(0x7778, 0x0, "AAAA"),
        new MockLog(0x7778, 0x1, "AAAA"),
        new MockLog(0x7779, 0x0, "AAAA"),
        new MockLog(0x7779, 0x1, "AAAA"),
      ])
    };
    var newBlock = new MockBlock(0x7779, "BBBB", "BBBB");
    var filters = [];
    var blockRetention = 5;
    reconcileBlocksAndLogs(wrappedGetBlockByHash, wrappedGetLogs, newHistory, newBlock, onLogAdded, onLogRemoved, filters, blockRetention, function (error, newHistory) {
      expect(error).to.be.undefined;
      expect(logRemovedAnnouncements).to.deep.equal([
        new MockLog(0x7779, 0x1, "AAAA"),
        new MockLog(0x7779, 0x0, "AAAA"),
        new MockLog(0x7778, 0x1, "AAAA"),
        new MockLog(0x7778, 0x0, "AAAA"),
      ]);
      expect(logAddedAnnonucements).to.deep.equal([
        new MockLog(0x7778, 0x0, "BBBB"),
        new MockLog(0x7778, 0x1, "BBBB"),
        new MockLog(0x7779, 0x0, "BBBB"),
        new MockLog(0x7779, 0x1, "BBBB"),
      ]);
      expect(newHistory.blockHistory.toJS()).to.deep.equal([
        new MockBlock(0x7777, "AAAA", "AAAA"),
        new MockBlock(0x7778, "BBBB", "AAAA"),
        new MockBlock(0x7779, "BBBB", "BBBB"),
      ]);
      expect(newHistory.logHistory.toJS()).to.deep.equal([
        new MockLog(0x7777, 0x0, "AAAA"),
        new MockLog(0x7777, 0x1, "AAAA"),
        new MockLog(0x7778, 0x0, "BBBB"),
        new MockLog(0x7778, 0x1, "BBBB"),
        new MockLog(0x7779, 0x0, "BBBB"),
        new MockLog(0x7779, 0x1, "BBBB"),
      ]);
      done();
    });
  });
});
