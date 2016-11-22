function getLengthBonus(word) {
	try {var length = word.length, lengthBonus = 0;
	if (length > 4) { lengthBonus += length - 4; } // single point for each Letter > 4
	if (length > 8) { lengthBonus += length - 8; } // double point for each Letter > 8
	if (length > 12) { lengthBonus += length - 12; } // triple point for each Letter > 12
	return lengthBonus;} catch (e) { throw e;}
}

var ALPHABETS = [
	{A: 1, B: 3, C: 3, D: 2, E: 1, F: 4, G: 2, H: 4, I: 1, J: 8, K: 5, L: 1, M: 3, N: 1, O: 1, P: 3, Q: 10, R: 1, S: 1, T: 1, U: 1, V: 4, W: 4, X: 8, Y: 4, Z: 10},
	{A:1,B:3,C:3,D:2,E:1,F:4,G:2,H:4,I:1,J:8,K:10,L:1,M:2,N:1,O:1,P:3,Q:8,R:1,S:1,T:1,U:1,V:4,W:10,X:10,Y:10,Z:10}
];

function getMovePoints(language, word) {
	try {
		var i = 0, score = 0, lettersValues = ALPHABETS[language - 1];
		for (i; i < word.length; i += 1) {
			var letter = word[i];
			score += lettersValues[letter];
		}
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
		var letters = getMoveLetters(gameData, move);
		move.lv = getMovePoints(gameData.l, letters);
		move.lb = getLengthBonus(move.mw);
		move.mb = gameData.a[actorIndex].m;
		move.pb = gameData.a[actorIndex].p;
		if (move.lv >= move.pb) {
			gameData.a[actorIndex].p = move.lv + 1;
			if (move.pb > 0) { gameData.a[actorIndex].m += 1; }
		}
		move.s = move.lv * gameData.a[actorIndex].m + move.lb;
		gameData.r[move.r].m[actorIndex] = move;
		gameData.a[actorIndex].s += move.s;
		return gameData;
	} catch (e) { throw e; }
}

function getMoveLetters(gameData, move) {
	try {
		// TEMP SOLUTION
		return move.mw;
	} catch (e) { throw e; }
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
		throw new PhotonException(WEB_ERRORS.UNEXPECTED_VALUE, 'Custom InitGame event: Wrong ActorNr', { w: args, d: data });
	}
	try {
		var eventData = args.Data;
		if (eventData.gt !== 2) {
			throw new PhotonException(WEB_ERRORS.UNEXPECTED_VALUE, 'Custom InitGame event: Wrong GameType', { w: args, d: data });
		}
    var a1_wordukens = [];
    var round0_grid = {};
    // TODO: remove version check when everyone updates
    if (args.AppVersion === "0.1.1d") {
        a1_wordukens = eventData.w;
        round0_grid = eventData.r.gs;
    } else {
        if (undefinedOrNull(eventData.w)) {
            a1_wordukens = [];
        } else {
            for(var i=0; i<eventData.w.length; i++){
                a1_wordukens[i] = {t:-1, wt:eventData.w[i], wi:i, v:false};
            }
        }
        for(var j=0; j<16; j++){
            round0_grid[String(j)] = eventData.r.gs[j];
        }
    }
		consumeWordukens(args.UserId, a1_wordukens, args.GameId);
		data = {a: [{id: args.UserId, n: args.Nickname, p: 0, s: 0, m: 1, w: a1_wordukens, ts: eventData.ts}],
		s: GameStates.UnmatchedPlaying, t: 0, rg: args.Region, l: eventData.l, gt: eventData.gt, ts: eventData.ts};
		data.r = [{gs: round0_grid, ts: eventData.r.ts, r: 0, m: [{}, {}]}];
		return data; // do not cache this event
	} catch (e) { throw e;}
}

function onJoinGame(args, data) {
	if (args.ActorNr !== 2 || data.a.length !== 1) {
		throw new PhotonException(WEB_ERRORS.EVENT_FAILURE, 'Custom JoinGame event: Wrong actorNr or duplicate event', { w: args, d: data });
	}
	try {
		if (data.s === GameStates.UnmatchedPlaying && data.t === 0) {
			data.s = GameStates.Playing;
		} else if (data.s === GameStates.UnmatchedWaiting && data.t === 1) {
			data.s = GameStates.P1Waiting;
		} else {
			throw new PhotonException(WEB_ERRORS.EVENT_FAILURE, 'Custom JoinGame event: unexpected Ss,Ts', { w: args, d: data });
		}
		updateSharedGroupEntry(getGamesListId(args.UserId), args.GameId, {});
		var eventData = args.Data;
    var a2_wordukens = [];
    // TODO: remove version check when everyone updates
    if (args.AppVersion === "0.1.1d") {
        a2_wordukens = eventData.w;
    } else if (undefinedOrNull(eventData.w)) {
        a2_wordukens = [];
    } else {
        for(var i=0; i<eventData.w.length; i++){
            a2_wordukens[i] = {t:-1, wt:eventData.w[i], wi:i, v:false};
        }
    }
		consumeWordukens(args.UserId, a2_wordukens, args.GameId);
		data.a[1] = {id: args.UserId, n: args.Nickname, p: 0, s: 0, m: 1, w: a2_wordukens, ts: eventData.ts};
		data.r[0].ts = eventData.ts;
		// send push
		eventData.GameId = args.GameId;
		eventData.EvCode = CustomEventCodes.JoinGame;
		eventData.n = args.Nickname;
		handlers.sendPushNotification({Recipient: data.a[0].id, Message: JSON.stringify({Message: args.Nickname + ' has joined a game!', CustomData: eventData})});
		return data; // do not cache this event
	} catch (e) { throw e;}
}

function onWordukenUsed(args, data) {
	try {
		var eventData = args.Data; // TODO: test args and eventData
		// TODO : test if worduken use is legit/legal
		data.a[args.ActorNr - 1].w[eventData.wi] = eventData;
		return data; // do not cache this event
	} catch (e) { throw e;}
}

function onEndOfTurn(args, data) {
	if (args.Data.t % 3 !== args.ActorNr || args.Data.t < 1 || args.Data.t >= MAX_TURNS_PER_GAME) {
		throw new PhotonException(WEB_ERRORS.EVENT_FAILURE, 'Custom EndOfTurn event: wrong t#', { w: args, d: data });
	}
	try {
		var eventData = args.Data; // TODO: test args and eventData
		var serverRoundNr = data.r.length - 1;
		var clientRoundNr = eventData.r; // TODO: get round# from turn#
		if (args.ActorNr === 1 && eventData.t === 1 && data.s === GameStates.UnmatchedPlaying) {
			data.s = GameStates.UnmatchedWaiting;
		} else if (data.s === GameStates.Playing && eventData.t === data.t + args.ActorNr) {
   		data.s = GameStates.Playing + args.ActorNr;
		} else if (serverRoundNr === clientRoundNr && data.t + eventData.t === 3 * (2 * serverRoundNr + 1)) {
			logException('Concurrency issue, GameId='+ args.GameId, {w: args, d: data});
			if (serverRoundNr === MAX_ROUNDS_PER_GAME - 1) {
				args.Data.SkipBlocked = true;
				args.EvCode = CustomEventCodes.EndOfGame;
				return onEndOfGame(args, data);
			} else {
				data.s = GameStates.Blocked;
			}
		}	else {
			if (!undefinedOrNull(data.r[clientRoundNr])) {
				var savedMove = data.r[clientRoundNr].m[args.ActorNr - 1];
			  // TODO: add coordinates array comparision?!
				if (savedMove.mw === eventData.mw &&
					savedMove.ts === eventData.ts &&
					savedMove.t === eventData.t &&
				  savedMove.wt === eventData.wt) { // TODO: compare wi when wt is not always sent?!
					// move already received
					return data;
				}
			}
			throw new PhotonException(WEB_ERRORS.EVENT_FAILURE, 'Unexpected GameState (' + data.s + ') in EndOfTurn, GameId=' + args.GameId, { w: args, d: data });
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
			throw new PhotonException(WEB_ERRORS.EVENT_FAILURE, 'Custom EndOfRound event: wrong t#', { w: args, d: data });
		}
		if (eventData.r.r !== data.r.length) {
			throw new PhotonException(WEB_ERRORS.EVENT_FAILURE, 'Custom EndOfRound event: wrong r#', { w: args, d: data });
		}
		if (data.s !== GameStates.Playing + (3 - args.ActorNr)) {
			throw new PhotonException(WEB_ERRORS.EVENT_FAILURE, 'Custom EndOfRound event: wrong s', { w: args, d: data });
		}
		data = addMoveToGame(data, args.ActorNr, eventData.m);
		var newRoundNr = eventData.r.r; // eventData.m.r + 1;
		data.r[newRoundNr] = { r: eventData.r.r, gs: eventData.r.gs, ts: eventData.r.ts, m: [{}, {}] };
		data.t = eventData.r.r * 3;
		data.s = GameStates.Playing;
		// push
		eventData.GameId = args.GameId;
		eventData.EvCode = CustomEventCodes.EndOfRound;
		handlers.sendPushNotification({Recipient: data.a[2 - args.ActorNr].id, Message: JSON.stringify({Message: args.Nickname + ' has played ' + eventData.m.mw, CustomData:eventData})});
		return addToEventsCache(args, data);
	} catch (e) { throw e;}
}

function onEndOfGame(args, data){
	try {
		var eventData = args.Data; // TODO: test args and eventData
		if (eventData.SkipBlocked !== true) {
			if (eventData.t !== MAX_TURNS_PER_GAME || eventData.t !== data.t + args.ActorNr) {
				throw new PhotonException(WEB_ERRORS.EVENT_FAILURE, 'Custom EndOfGame event: wrong t#', { w: args, d: data });
			}
		}
		if (data.s !== GameStates.Playing + (3 - args.ActorNr)) {
			throw new PhotonException(WEB_ERRORS.EVENT_FAILURE, 'Custom EndOfGame event: wrong s', { w: args, d: data });
		}
		if (data.r.length !== MAX_ROUNDS_PER_GAME) {
			throw new PhotonException(WEB_ERRORS.EVENT_FAILURE, 'Custom EndOfGame event: wrong r#', { w: args, d: data });
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
		redeemWordukens(args.UserId, gameData.a[args.ActorNr - 1].w, args.GameId);
		/*if (args.ActorNr === 2) {
			deleteSharedGroupEntry(getGamesListId(args.UserId), args.GameId);
		}*/
		// push
		eventData.GameId = args.GameId;
		var msg = '. Game has ended, ';
		if (data.s === GameStates.EndedDraw) {
			msg += 'Tie!';
		} else if (data.s === GameStates.EndedDraw + args.ActorNr) {
			msg += 'You lost!';
		} else /*if (data.s === GameStates.EndedDraw + 3 - args.ActorNr)*/ {
			msg += 'You won!';
		}
		eventData.EvCode = CustomEventCodes.EndOfGame;
		handlers.sendPushNotification({Recipient: data.a[2 - args.ActorNr].id, Message: JSON.stringify({Message: args.Nickname + ' has played ' + eventData.mw + msg, CustomData:eventData})});
		return addToEventsCache(args, data);
	} catch (e) { throw e;}
}

function onNewRound(args, data){
	if (data.s !== GameStates.Blocked){
		throw new PhotonException(WEB_ERRORS.EVENT_FAILURE, 'Unexpected GameState onNewRound', { w: args, d: data });
	}
	try {
		var eventData = args.Data; // TODO: test args and eventData
		var newRoundNr = eventData.r; // eventData.m.r + 1;
		data.r[newRoundNr] = { r: eventData.r, gs: eventData.gs, ts: eventData.ts, m: [{}, {}] };
		data.s = GameStates.Playing;
		// TODO: do not presume last cached event is EndOfTurn who caused the block
		data.Cache[data.Cache.length - 1][1] = CustomEventCodes.EndOfRound;
		data.Cache[data.Cache.length - 1][2] = { m: data.Cache[data.Cache.length - 1][2], r: eventData };
		//data.Cache[data.Cache.length - 1][2].m.t = data.t;
		return data;
	} catch (e) {throw e;}
}


function onResign(args, gameData){
	var actorNr = 1;
	if (args.UserId !== getCreatorId(args.GameId)) {
		actorNr = 2;
		if (gameData.a.length !== 2) {
			throw new PhotonException(WEB_ERRORS.EVENT_FAILURE, 'Cannot resign: Wrong Player ('+actorNr+'):'+args.UserId+' not found!', { w: args, d: gameData });
		}
	}
	if (gameData.a[actorNr - 1].id !== args.UserId) {
		throw new PhotonException(WEB_ERRORS.EVENT_FAILURE, 'Cannot resign: Wrong Player ('+actorNr+'):'+args.UserId+' != saved:'+gameData.a[actorNr - 1].id, { w: args, d: gameData });
	}
	if (gameData.s <= GameStates.MatchmakingTimedOut || gameData.s >= GameStates.P1Resigned) {
		throw new PhotonException(WEB_ERRORS.EVENT_FAILURE, 'Cannot resign: Game is over already, state='+gameData.s, { w: args, d: gameData });
	}
	gameData.s = GameStates.Blocked + actorNr;
	gameData.deletionFlag = actorNr;
	redeemWordukens(args.UserId, gameData.a[actorNr - 1].w, args.GameId);
	if (gameData.a.length === 2) {
		// send push
		handlers.sendPushNotification({Recipient: gameData.a[2 - actorNr].id, Message: JSON.stringify({Message: gameData.a[actorNr - 1].n + ' resigned!', CustomData: {EvCode: CustomEventCodes.Resign, GameId: args.GameId}})});
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
		for(var i=0; i<data.Cache.length; i++){
			var cv = data.Cache[i];
			if (cv[0] === args.ActorNr && cv[1] === args.EvCode) {
				switch (cv[1]) {
					case CustomEventCodes.EndOfTurn:
					case CustomEventCodes.EndOfGame:
						if (cv[2].t === args.Data.t) {
							throw new PhotonException(WEB_ERRORS.EVENT_FAILURE, 'Trying to cache duplicate event', { w: args, d: data });
						}
						break;
					case CustomEventCodes.EndOfRound:
						if (cv[2].r.r === args.Data.r.r) {
							throw new PhotonException(WEB_ERRORS.EVENT_FAILURE, 'Trying to cache duplicate event', { w: args, d: data });
						}
						break;
					default:
						break;
				}
			}
		}
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
		throw new PhotonException(WEB_ERRORS.EVENT_FAILURE, 'Unexpected ActorNr =' + args.ActorNr, { w: args, d: data });
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

function consumeWordukens(userId, wordukens, gameId) {
  try {
		var itemsToConsume = {}, itemKey = "";
		for(var i=0; i<wordukens.length; i++){
			switch (wordukens[i].wt) {
				case WordukenType.BestMove:
					itemKey = "com.ThugLeaf.WordCoreAlpha.Worduken.BestMove";
					break;
				case WordukenType.Incrementor:
					itemKey = "com.ThugLeaf.WordCoreAlpha.Worduken.Incrementor";
					break;
				case WordukenType.WildCard:
					itemKey = "com.ThugLeaf.WordCoreAlpha.Worduken.WildCard";
					break;
				case WordukenType.SingleColor:
					itemKey = "com.ThugLeaf.WordCoreAlpha.Worduken.SingleColor";
					break;
				default:
					continue;
		  }
			if (undefinedOrNull(itemsToConsume[itemKey])) {
				itemsToConsume[itemKey] = 1;
			} else {
				itemsToConsume[itemKey] = itemsToConsume[itemKey] + 1;
			}
		}
		var inventory = getUserInventory(userId);
		for(itemKey in itemsToConsume) {
			if (itemsToConsume.hasOwnProperty(itemKey)) {
					var instanceId = null;
					for(var j=0; j<inventory.length; j++) {
						if (inventory[j].ItemId === itemKey) {
							if (undefinedOrNull(instanceId)) {
								if (inventory[j].RemainingUses >= itemsToConsume[itemKey]) {
									instanceId = inventory[j].ItemInstanceId;
								} else {
									logException('Unexpected:Number of item' + itemKey + ' not allowed'+ gameId, {i:inventory, e:itemsToConsume, w: wordukens});
									return;
								}
							} else {
								logException('Unexpected:ItemId '+itemKey+' not unique in inventory', {i:inventory, e:itemsToConsume, w: wordukens});
								return;
							}
						}
					}
					if (undefinedOrNull(instanceId)) {
						logException('Unexpected:ItemId '+itemKey+' not found', {i:inventory, e:itemsToConsume, w: wordukens});
						return;
					} else {
						consumeItem(userId, instanceId, itemsToConsume[itemKey]);
					}
			}
		}
	} catch (e) {
			logException('Unexpected:consumeWordukens exception', {err:e, w: wordukens, u: userId, g:gameId});
	}
}

// TODO: mark wordukens as redeemed to not redeem twice or more! log warning if trying to do that
function redeemWordukens(userId, wordukens, gameId){
	try {
		var itemsToRedeem = {}, itemKey = "";
		for(var i=0; i<wordukens.length; i++) {
			if (wordukens[i].t > -1) {
				switch (wordukens[i].wt) {
					case WordukenType.BestMove:
						itemKey = "com.ThugLeaf.WordCoreAlpha.Worduken.BestMove";
						break;
					case WordukenType.Incrementor:
						itemKey = "com.ThugLeaf.WordCoreAlpha.Worduken.Incrementor";
						break;
					case WordukenType.WildCard:
						itemKey = "com.ThugLeaf.WordCoreAlpha.Worduken.WildCard";
						break;
					case WordukenType.SingleColor:
						itemKey = "com.ThugLeaf.WordCoreAlpha.Worduken.SingleColor";
						break;
					default:
						continue;
				}
				if (undefinedOrNull(itemsToRedeem[itemKey])) {
					itemsToRedeem[itemKey] = 1;
				} else {
					itemsToRedeem[itemKey] = itemsToRedeem[itemKey] + 1;
				}
			}
		}
		var inventory = getUserInventory(userId);
		for(itemKey in itemsToConsume) {
			if (itemsToRedeem.hasOwnProperty(itemKey)) {
					var instanceId = null;
					for(var j=0; j<inventory.length; j++) {
						if (inventory[j].ItemId === itemKey) {
							if (undefinedOrNull(instanceId)) {
								instanceId = inventory[j].ItemInstanceId;
							} else {
								logException('Unexpected:ItemId '+itemKey+' not unique in inventory', {i:inventory, e:itemsToConsume, w: wordukens});
								return;
							}
						}
					}
					if (undefinedOrNull(instanceId)) {
						logException('Unexpected:ItemId '+itemKey+' not found', {i:inventory, e:itemsToConsume, w: wordukens});
						return;
					} else {
						modifyItemUsers(userId, instanceId, itemsToRedeem[itemKey]);
					}
			}
		}
	} catch (e){
		logException('Unexpected:redeemWordukens exception', {err:e, w: wordukens, u: userId, g:gameId});
	}
}
