// Test to make sure that tag ranges get split when partial keys are used for the tag ranges
import {findChunksUtil} from "jstests/sharding/libs/find_chunks_util.js";

var s = new ShardingTest({shards: 2, mongos: 1});

assert.commandWorked(s.s0.adminCommand({enablesharding: "test"}));
s.ensurePrimaryShard('test', s.shard1.shardName);
assert.commandWorked(s.s0.adminCommand({shardcollection: "test.foo", key: {_id: 1, a: 1}}));

assert.eq(1, findChunksUtil.findChunksByNs(s.config, "test.foo").itcount());

s.addShardTag(s.shard0.shardName, "a");
s.addShardTag(s.shard0.shardName, "b");

s.addTagRange("test.foo", {_id: 5}, {_id: 10}, "a");
s.addTagRange("test.foo", {_id: 10}, {_id: 15}, "b");

s.startBalancer();

assert.soon(function() {
    return findChunksUtil.findChunksByNs(s.config, "test.foo").itcount() == 4;
}, 'Split did not occur', 3 * 60 * 1000);

s.awaitBalancerRound();
s.printShardingStatus(true);
assert.eq(4, findChunksUtil.findChunksByNs(s.config, "test.foo").itcount(), 'Split points changed');

findChunksUtil.findChunksByNs(s.config, "test.foo").forEach(function(chunk) {
    var numFields = 0;
    for (var x in chunk.min) {
        numFields++;
        assert(x == "_id" || x == "a", tojson(chunk));
    }
    assert.eq(2, numFields, tojson(chunk));
});

// Check chunk mins correspond exactly to tag range boundaries, extended to match shard key
assert.eq(
    1,
    findChunksUtil.findChunksByNs(s.config, "test.foo", {min: {_id: MinKey, a: MinKey}}).itcount());
assert.eq(
    1, findChunksUtil.findChunksByNs(s.config, "test.foo", {min: {_id: 5, a: MinKey}}).itcount());
assert.eq(
    1, findChunksUtil.findChunksByNs(s.config, "test.foo", {min: {_id: 10, a: MinKey}}).itcount());
assert.eq(
    1, findChunksUtil.findChunksByNs(s.config, "test.foo", {min: {_id: 15, a: MinKey}}).itcount());

s.stop();