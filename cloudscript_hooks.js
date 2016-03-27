function getLengthBonus(word) {
	try {var length = word.length, lengthBonus = 0;
	if (length > 4) { lengthBonus += length - 4; } // single point for each Letter > 4
	if (length > 8) { lengthBonus += length - 8; } // double point for each Letter > 8
	if (length > 12) { lengthBonus += length - 12; } // triple point for each Letter > 12
	return lengthBonus;} catch (e) { throw e;}

}

function getMovePoints(word) {
	try {var LETTERS_POINTS = {A: 1, B: 3, C: 3, D: 2, E: 1, F: 4, G: 2, H: 4, I: 1, J: 8, K: 5, L: 1, M: 3, N: 1, O: 1, P: 3, Q: 10, R: 1, S: 1, T: 1, U: 1, V: 4, W: 4, X: 8, Y: 4, Z: 10}, i = 0, score = 0;
word = word.toUpperCase();
for (i; i < word.length; i += 1) { score +=  LETTERS_POINTS[word.charAt(i)]; }
return score;} catch (e) { throw e;}
}

var WordukenType = { NoWorduken : 0, BestMove : 1, WildCard : 2, SingleColor : 3, Shuffler : 4, Incrementor : 5};

function addMoveToGame(gameData, actorNr, move) {
	try {	// TODO : test if move is legit/legal
		gameData.r[move.r].m[actorNr - 1] = move;
		if (move.wt !== 0) {
			gameData.a[actorNr - 1].w[move.wi].v = true; // validate worduken use (if any)
			if (move.wt === WordukenType.Incrementor) { gameData.a[actorNr - 1].m += 1; }
		}
		var mp = getMovePoints(move.mw);
		if (mp > gameData.a[actorNr - 1].p) {
	        gameData.a[actorNr - 1].p = mp;
	        gameData.a[actorNr - 1].m += 1;
	    }
		gameData.a[actorNr - 1].s += (mp + getLengthBonus(move.mw));
		return gameData;} catch (e) { throw e;}
}


var GameStates = {
    Undefined : 0,              // 0
    MatchmakingTimedOut : 1,    // 1
    UnmatchedPlaying : 2,       // 2
    UnmatchedWaiting : 3,
    Playing : 4, // 4
    P1Waiting : 5, // 5
    P2Waiting : 6,
    P1Resigned : 7,
    P2Resigned : 8,
    TimedOutDraw : 9,
    TimedOutP1Won : 10,
    TimedOutP2Won : 11,
    EndedDraw : 12,
    EndedP1Won : 13,
    EndedP2Won : 14
};

function onInitGame(args, data) {
	try {var eventData = args.Data;
		data = {a: [{id: args.UserId, n: args.Nickname, p: 0, s: 0, m: 1, w: eventData.w}],
				s: GameStates.UnmatchedPlaying, t: 0, rg: args.Region, l: eventData.l, gt: eventData.gt, ts: eventData.ts};
		data.r = [{gs: eventData.r.gs, ts: eventData.r.ts, r: eventData.r.r, m: [{}, {}]}];
		return data; // do not cache this event
	} catch (e) { throw e;}
}

function onJoinGame(args, data) {
	try {updateSharedGroupEntry(getGamesListId(args.UserId), args.GameId, {});
	var eventData = args.Data;
	data.s += 2;
	//data.a.push({id: args.UserId, n: eventData.n, p: 0, s: 0, m: 1, w: eventData.w});
	data.a[1] = {id: args.UserId, n: args.Nickname, p: 0, s: 0, m: 1, w: eventData.w};
	return addToEventsCache(args, data);} catch (e) { throw e;}

}

function onWordukenUsed(args, data) {
	try {  var eventData = args.Data; // TODO: test args and eventData
	// TODO : test if worduken use is legit/legal
		data.a[args.ActorNr - 1].w[eventData.wi] = eventData;
		return addToEventsCache(args, data);} catch (e) { throw e;}

}

function onEndOfTurn(args, data) {
	try {  var eventData = args.Data; // TODO: test args and eventData
		data = addMoveToGame(data, args.ActorNr, eventData);
		data.t += args.ActorNr;
		if (args.ActorNr === 1 && data.s === GameStates.UnmatchedPlaying) {
			data.s = GameStates.UnmatchedWaiting;
		} else {
   		data.s = GameStates.Playing + args.ActorNr;
		}
		// TODO : send push?
		if (data.s === GameStates.UnmatchedWaiting) { // cache this directly in Photon
			return data;
		}
		return addToEventsCache(args, data);} catch (e) { throw e;}
}

function onEndOfRound(args, data) {
	try {var eventData = args.Data; // TODO: test args and eventData
	data = addMoveToGame(data, args.ActorNr, eventData.m);
	data.r.push(eventData.r);
	data.r[eventData.m.r + 1].m = [{}, {}];
	data.t += args.ActorNr;
	data.s = GameStates.Playing;
// TODO : send push
return addToEventsCache(args, data);} catch (e) { throw e;}
}

function onEndOfGame(args, data) {
	try {    var eventData = args.Data; // TODO: test args and eventData
		  data = addMoveToGame(data, args.ActorNr, eventData);
	    data.t += args.ActorNr;
		if (data.a[0].s === data.a[1].s) {
			data.s = GameStates.EndedDraw;
		} else if (data.a[0].s > data.a[1].s) {
			data.s = GameStates.EndedP1Won;
		} else {
			data.s = GameStates.EndedP2Won;
		}
	  deleteOrFlagGames([args.GameId]);
		// TODO : send push
		return addToEventsCache(args, data);} catch (e) { throw e;}

}

var CustomEventCodes = {Undefined : 0, InitGame : 1, JoinGame : 2, WordukenUsed : 3, EndOfTurn : 4, EndOfRound : 5, EndOfGame : 6,
												JoinGameAck: 7, WordukenUsedAck: 8, EndOfTurnAck: 9, EndOfRoundAck: 10, EndOfGameAck: 11};
var MAX_ROUNDS_PER_GAME = 5;
var MAX_TURNS_PER_GAME = 3 * MAX_ROUNDS_PER_GAME;


// args = PathEvent webhook args, you need args.EvCode and args.Data (event data).
// data = Room data, modify it but do not delete or overwrite existing properties. this will be saved for you.
function addToEventsCache(args, data) {
	try {
		if (!data.hasOwnProperty('Cache')) {
			data.Cache = {};
		}
		if (!data.Cache.hasOwnProperty((3 - args.ActorNr))) {
			data.Cache[3 - args.ActorNr] = [];
		}
		// TODO: test if opponent is inactive
		var cachedEvent = [
			args.ActorNr,
			args.EvCode,
			args.Data
		];
		data.Cache[3 - args.ActorNr].push(cachedEvent);
		return data;
	} catch (e) {
		throw e;
	}
}

// args = PathEvent webhook args, you need args.EvCode and args.Data (event data).
// data = Room data, modify it but do not delete or overwrite existing properties. this will be saved for you.
function removeFromEventsCache(args, data) {
	try {
		var filter = args.Data;
		if (!data.hasOwnProperty('Cache') && !data.Cache.hasOwnProperty(args.ActorNr)) {
			// TODO: throw error
		}
		for(var i=0; i < data.Cache[args.ActorNr].length; i++) {
				var event = data.Cache[args.ActorNr][i];
				if (event[1] === args.EvCode - 5 && args.EvCode > 6) {
					var foundFlag = true;
					for(var key in filter) {
							if (filter.hasOwnProperty(key) && !event[2].hasOwnProperty(key)) {
									foundFlag = false;
									break;
							}
					}
					if (foundFlag === true) {
						data.Cache[args.ActorNr].Splice(i, 1);
						return data;
					}
				}
		}
		// TODO: throw error
		return data;
	} catch (e) {
		throw e;
	}
}

// args = PathEvent webhook args, you need args.EvCode and args.Data (event data).
// data = Room data, modify it but do not delete or overwrite existing properties. this will be saved for you.
function onEventReceived(args, data) {
	try {
  switch (args.EvCode) {
    case CustomEventCodes.InitGame: // args.ActorNr === 1
				if (args.ActorNr !== 1) {
						throw new PhotonException(5, "Custom InitGame event: Wrong actorNr", getISOTimestamp(), { webhook: args, gameData: data });
				}
        return onInitGame(args, data);
    case CustomEventCodes.JoinGame: // args.ActorNr === 2
				if (args.ActorNr !== 2 || data.a.length !== 1) {
						throw new PhotonException(5, "Custom JoinGame event: Wrong actorNr or duplicate event", getISOTimestamp(), { webhook: args, gameData: data });
				}
        return onJoinGame(args, data);
    case CustomEventCodes.WordukenUsed:
        return onWordukenUsed(args, data);
    case CustomEventCodes.EndOfTurn: // args.Data.t % 3 !== 0
				if (args.Data.t % 3 === 0 || args.Data.t < 1 || args.Data.t >= MAX_TURNS_PER_GAME) {
						throw new PhotonException(5, "Custom EndOfTurn event: wrong turnNr", getISOTimestamp(), { webhook: args, gameData: data });
				}
        return onEndOfTurn(args, data);
    case CustomEventCodes.EndOfRound: // args.Data.t % 3 === 0
				if (args.Data.m.t % 3 !== 0 || args.Data.m.t < 3 || args.Data.m.t > MAX_TURNS_PER_GAME) {
						throw new PhotonException(5, "Custom EndOfRound event: wrong turnNr", getISOTimestamp(), { webhook: args, gameData: data });
				}
        return onEndOfRound(args, data);
    case CustomEventCodes.EndOfGame: // args.Data.t === MAX_TURNS_PER_GAME
				if (args.Data.t % 3 !== MAX_TURNS_PER_GAME) {
						throw new PhotonException(5, "Custom EndOfGame event: wrong turnNr", getISOTimestamp(), { webhook: args, gameData: data });
				}
        return onEndOfGame(args, data);
		default:
				return removeFromEventsCache(args, data);
	}
} catch (e) {
	throw e;
}
}
