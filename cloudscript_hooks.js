function getLengthBonus(word) {
	try {var length = word.length, lengthBonus = 0;
	if (length > 4) { lengthBonus += length - 4; } // single point for each Letter > 4
	if (length > 8) { lengthBonus += length - 8; } // double point for each Letter > 8
	if (length > 12) { lengthBonus += length - 12; } // triple point for each Letter > 12
	return lengthBonus;} catch (e) { throw e;}
}

function getMovePoints(word) {
	try {
		var LETTERS_POINTS = {A: 1, B: 3, C: 3, D: 2, E: 1, F: 4, G: 2, H: 4, I: 1, J: 8, K: 5, L: 1, M: 3, N: 1, O: 1, P: 3, Q: 10, R: 1, S: 1, T: 1, U: 1, V: 4, W: 4, X: 8, Y: 4, Z: 10}, i = 0, score = 0;
		word = word.toUpperCase();
		for (i; i < word.length; i += 1) { score +=  LETTERS_POINTS[word.charAt(i)]; }
		return score;
	} catch (e) { throw e;}
}

var WordukenType = { NoWorduken : 0, BestMove : 1, WildCard : 2, SingleColor : 3, Shuffler : 4, Incrementor : 5};

function addMoveToGame(gameData, actorNr, move) {
	try {	// TODO : test if move is legit/legal
		var actorIndex = actorNr - 1;
		if (move.wt !== 0) {
			gameData.a[actorIndex].w[move.wi].v = true; // validate worduken use (if any)
			if (move.wt === WordukenType.Incrementor) { gameData.a[actorIndex].m += 1; }
		}
		move.lv = getMovePoints(move.mw);
		move.lb = getLengthBonus(move.mw);
		move.mb = gameData.a[actorIndex].m;
		move.pb = gameData.a[actorIndex].p;
		if (move.lv >= move.pb) {
        gameData.a[actorIndex].p = move.lv + 1;
        if (move.pb > 0) { gameData.a[actorIndex].m += 1; }
    }
		move.ts = move.lv * gameData.a[actorIndex].m + move.lb;
		gameData.r[move.r].m[actorIndex] = move;
		gameData.a[actorIndex].s += move.ts;
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
		Blocked : 7,
    P1Resigned : 8,
    P2Resigned : 9,
    TimedOutDraw : 10,
    TimedOutP1Won : 11,
    TimedOutP2Won : 12,
    EndedDraw : 13,
    EndedP1Won : 14,
    EndedP2Won : 15
};

function onInitGame(args, data) {
	if (args.ActorNr !== 1) {
			throw new PhotonException(5, "Custom InitGame event: Wrong actorNr", getISOTimestamp(), { w: args, d: data });
	}
	try {
		var eventData = args.Data;
		data = {a: [{id: args.UserId, n: args.Nickname, p: 0, s: 0, m: 1, w: eventData.w}],
				s: GameStates.UnmatchedPlaying, t: 0, rg: args.Region, l: eventData.l, gt: eventData.gt, ts: eventData.ts};
		data.r = [{gs: eventData.r.gs, ts: eventData.r.ts, r: 0, m: [{}, {}]}];
		return data; // do not cache this event
	} catch (e) { throw e;}
}

function onJoinGame(args, data) {
	if (args.ActorNr !== 2 || data.a.length !== 1) {
			throw new PhotonException(5, "Custom JoinGame event: Wrong actorNr or duplicate event", getISOTimestamp(), { w: args, d: data });
	}
	try {
		if (data.s === GameStates.UnmatchedPlaying && data.t === 0) {
			data.s = GameStates.Playing;
		} else if (data.s === GameStates.UnmatchedWaiting && data.t === 1){
			data.s = GameStates.P1Waiting;
		} else {
			throw new PhotonException(5, "Custom JoinGame event: unexpected Ss,Ts", getISOTimestamp(), { w: args, d: data });
		}
		updateSharedGroupEntry(getGamesListId(args.UserId), args.GameId, {});
		var eventData = args.Data;
		data.a[1] = {id: args.UserId, n: args.Nickname, p: 0, s: 0, m: 1, w: eventData.w};
		return data; // do not cache this event
	} catch (e) { throw e;}
}

function onWordukenUsed(args, data) {
	try {  var eventData = args.Data; // TODO: test args and eventData
	// TODO : test if worduken use is legit/legal
		data.a[args.ActorNr - 1].w[eventData.wi] = eventData;
		return data; // do not cache this event
	} catch (e) { throw e;}
}

function onEndOfTurn(args, data) {
	if (args.Data.t % 3 !== args.ActorNr || args.Data.t < 1 || args.Data.t >= MAX_TURNS_PER_GAME) {
			throw new PhotonException(5, 'Custom EndOfTurn event: wrong t#', getISOTimestamp(), { w: args, d: data });
	}
	try {
		var eventData = args.Data; // TODO: test args and eventData
		if (args.ActorNr === 1 && eventData.t === 1 && data.s === GameStates.UnmatchedPlaying) {
			data.s = GameStates.UnmatchedWaiting;
		} else if (data.s === GameStates.Playing && eventData.t === data.t + args.ActorNr) {
   		data.s = GameStates.Playing + args.ActorNr;
		} else if (data.s === GameStates.Playing + (3 - args.ActorNr) && data.t % 3 === (3 - args.ActorNr) && eventData.t === data.t - 3 + 2 * args.ActorNr) {
			logException(getISOTimestamp(), {w: args, d: data}, 'Concurrency issue, GameId='+ args.GameId);
			data.s = GameStates.Blocked;
		}	else {
			throw new PhotonException(5, 'Unexpected GameState (' + data.s + ') in EndOfTurn, GameId=' + args.GameId, getISOTimestamp(), { w: args, d: data });
		}
		data = addMoveToGame(data, args.ActorNr, eventData);
		data.t += args.ActorNr;
		// TODO : send push?
		return addToEventsCache(args, data);
	} catch (e) { throw e;}
}

function onEndOfRound(args, data) {
	try {
		var eventData = args.Data; // TODO: test args and eventData
		if (eventData.m.t % 3 !== 0 || eventData.m.t < 3 || eventData.m.t > MAX_TURNS_PER_GAME || eventData.m.t !== data.t + args.ActorNr) {
				throw new PhotonException(5, "Custom EndOfRound event: wrong t#", getISOTimestamp(), { w: args, d: data });
		}
		if (eventData.r.r !== data.r.length) {
				throw new PhotonException(5, "Custom EndOfRound event: wrong r#", getISOTimestamp(), { w: args, d: data });
		}
		if (data.s !== GameStates.Playing + (3 - args.ActorNr)) {
				throw new PhotonException(5, "Custom EndOfRound event: wrong s", getISOTimestamp(), { w: args, d: data });
		}
		data = addMoveToGame(data, args.ActorNr, eventData.m);
		var newRoundNr = eventData.r.r; // eventData.m.r + 1;
		data.r[newRoundNr] = { r: eventData.r.r, gs: eventData.r.gs, ts: eventData.r.ts, m: [{}, {}] };
		data.t = eventData.r.r * 3;
		data.s = GameStates.Playing;
		// TODO : send push
		return addToEventsCache(args, data);
	} catch (e) { throw e;}
}

function onEndOfGame(args, data){
	try {
		var eventData = args.Data; // TODO: test args and eventData
		if (eventData.t !== MAX_TURNS_PER_GAME || eventData.t !== data.t + args.ActorNr) {
				throw new PhotonException(5, 'Custom EndOfGame event: wrong t#', getISOTimestamp(), { w: args, d: data });
		}
		if (data.s !== GameStates.Playing + (3 - args.ActorNr)) {
				throw new PhotonException(5, 'Custom EndOfGame event: wrong s', getISOTimestamp(), { w: args, d: data });
		}
		if (data.r.length !== MAX_ROUNDS_PER_GAME){
				throw new PhotonException(5, 'Custom EndOfGame event: wrong r#', getISOTimestamp(), { w: args, d: data });
		}
	  data = addMoveToGame(data, args.ActorNr, eventData);
    data.t = MAX_TURNS_PER_GAME;
		if (data.a[0].s === data.a[1].s) {
			data.s = GameStates.EndedDraw;
		} else if (data.a[0].s > data.a[1].s) {
			data.s = GameStates.EndedP1Won;
		} else {
			data.s = GameStates.EndedP2Won;
		}
		data.deletionFlag = args.ActorNr;
		if (args.ActorNr === 2) {
			deleteSharedGroupEntry(getGamesListId(args.UserId), args.GameId);
		}
		// TODO : send push
		return addToEventsCache(args, data);
	} catch (e) { throw e;}
}

function onNewRound(args, data){
	if (data.s !== GameStates.Blocked){
		throw new PhotonException(5, "Unexpected GameState onNewRound", getISOTimestamp(), { w: args, d: data });
	}
	try {
		var eventData = args.Data; // TODO: test args and eventData
		var newRoundNr = eventData.r.r; // eventData.m.r + 1;
		data.r[newRoundNr] = { r: eventData.r.r, gs: eventData.r.gs, ts: eventData.r.ts, m: [{}, {}] };
		data.s = GameStates.Playing;
		data.Cache[data.Cache.length - 1][1] = CustomEventCodes.EndOfRound;
		data.Cache[data.Cache.length - 1][2] = {m:data.Cache[data.Cache.length - 1][2], r:eventData};
		return data;
	} catch (e) {throw e;}
}


function onResign(args, gameData){
	var actorNr = args.ActorNr;
	if (gameData.a[actorNr - 1].id === args.UserId &&
		gameData.s > GameStates.UnmatchedPlaying &&
		gameData.s < GameStates.P1Resigned) {
		gameData.s = GameStates.Blocked + actorNr;
		gameData.deletionFlag = actorNr;
		if (actorNr === 2) {
			deleteSharedGroupEntry(getGamesListId(args.UserId), args.GameId);
		}
	}
	return gameData;
}

var CustomEventCodes = {Undefined : 0, InitGame : 1, JoinGame : 2, WordukenUsed : 3, EndOfTurn : 4, EndOfRound : 5, EndOfGame : 6, NewRound : 7, Resign: 8};
var MAX_ROUNDS_PER_GAME = 5;
var MAX_TURNS_PER_GAME = 3 * MAX_ROUNDS_PER_GAME;


// args = PathEvent webhook args, you need args.EvCode and args.Data (event data).
// data = Room data, modify it but do not delete or overwrite existing properties. this will be saved for you.
function addToEventsCache(args, data) {
	try {
		if (!data.hasOwnProperty('Cache')) {
			data.Cache = [];
		}
		// TODO: test if opponent is inactive
		// TODO: avoid adding duplicate events to cache!!
		var cachedEvent = [
			args.ActorNr,
			args.EvCode,
			args.Data
		];
		data.Cache.push(cachedEvent);
		return data;
	} catch (e) {
		throw e;
	}
}


// args = PathEvent webhook args, you need args.EvCode and args.Data (event data).
// data = Room data, modify it but do not delete or overwrite existing properties. this will be saved for you.
function onEventReceived(args, data) {
	if (args.ActorNr < 1 || args.ActorNr > 2) {
		throw new PhotonException(5, 'Unexpected ActorNr =' + args.ActorNr, getISOTimestamp(), { w: args, d: data });
	}
	try {
	  switch (args.EvCode) {
	    case CustomEventCodes.InitGame: // args.ActorNr === 1
	        return onInitGame(args, data);
	    case CustomEventCodes.JoinGame: // args.ActorNr === 2
	        return onJoinGame(args, data);
	    case CustomEventCodes.WordukenUsed:
	        return onWordukenUsed(args, data);
	    case CustomEventCodes.EndOfTurn: // args.Data.t % 3 !== 0
	        return onEndOfTurn(args, data);
	    case CustomEventCodes.EndOfRound: // args.Data.t % 3 === 0
	        return onEndOfRound(args, data);
	    case CustomEventCodes.EndOfGame: // args.Data.t === MAX_TURNS_PER_GAME
	        return onEndOfGame(args, data);
			case CustomEventCodes.NewRound:
					return onNewRound(args, data);
			case CustomEventCodes.Resign:
					return onResign(args, data);
			default: // TODO: Unexpected throw error?
					return data;
		}
	} catch (e) {
		throw e;
	}
}
