function getLengthBonus(word) {
	try {var length = word.length, lengthBonus = 0;
	if (length > 4) { lengthBonus += length - 4; } // single point for each Letter > 4
	if (length > 8) { lengthBonus += length - 8; } // double point for each Letter > 8
	if (length > 12) { lengthBonus += length - 12; } // triple point for each Letter > 12
	return lengthBonus;} catch (e) { throw e;}
}

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


function onInitGame(args, data) {
	if (args.ActorNr !== 1) {
		throw new PhotonException(WEB_ERRORS.UNEXPECTED_VALUE, 'Custom InitGame event: Wrong ActorNr', { w: args, d: data });
	}
	try {
		var eventData = args.Data;
		if (eventData.gt !== 2 && eventData.gt !== 3) {
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
		// TEMP: to not let players alone
		if (ignoredUsers.indexOf(args.UserId) === -1) {
			eventData.EvCode = CustomEventCodes.InitGame;
			eventData.GameId = args.GameId;
			eventData.Target = "A87B7470F4AEDC76";
			var language = "ENGLISH";
			if (data.l === 2) {
				language = "FRENCH";
			}
			handlers.sendPushNotification({Recipient: "A87B7470F4AEDC76", Message: JSON.stringify({Message: args.Nickname + ' created '+language+' game, v='+args.AppVersion, CustomData: eventData})});
			eventData.Target = "73BD7B8F4F332064";
			handlers.sendPushNotification({Recipient: "73BD7B8F4F332064", Message: JSON.stringify({Message: args.Nickname + ' created '+language+' game, v='+args.AppVersion, CustomData: eventData})});
		}
		if (data.gt === 3) { // CHALLENGE
			eventData.Target = eventData.OpponentId;
			data.a[1] = {id:eventData.OpponentId, w: []};
			//delete eventData.OpponentId;
			handlers.sendPushNotification({Recipient: eventData.OpponentId, Message: JSON.stringify({Message: args.Nickname + ' challenged you to a game !', CustomData: eventData})});
			updateSharedGroupEntry(getGamesListId(eventData.OpponentId), args.GameId, {});
		}
		return data; // do not cache this event
	} catch (e) { throw e;}
}

function onJoinGame(args, data) {
	if (args.ActorNr !== 2 || (data.a.length !== 1 && data.gt !== 3)) {
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
		if (!undefinedOrNull(args.State)) {
			for(var i = 0; i < args.State.ActorList.length; i++) {
				if (args.State.ActorList[i].UserId === data.a[2 - args.ActorNr].id &&
						args.State.ActorList[i].IsActive === true) {
					return data; // skip sending push notification!
				}
			}
		}
		// send push
		eventData.GameId = args.GameId;
		eventData.EvCode = CustomEventCodes.JoinGame;
		eventData.n = args.Nickname;
		eventData.Target = data.a[0].id;
		if (data.gt === 3) {
			handlers.sendPushNotification({Recipient: data.a[0].id, Message: JSON.stringify({Message: args.Nickname + ' accepted your challenge!', CustomData: eventData})});
		} else {
			handlers.sendPushNotification({Recipient: data.a[0].id, Message: JSON.stringify({Message: args.Nickname + ' has joined a game!', CustomData: eventData})});
		}
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
		if (!undefinedOrNull(args.State)) {
			for(var i = 0; i < args.State.ActorList.length; i++) {
				if (args.State.ActorList[i].UserId === data.a[2 - args.ActorNr].id &&
						args.State.ActorList[i].IsActive === true){
					return addToEventsCache(args, data); // skip sending push notification!
				}
			}
		}
		// push
		eventData.GameId = args.GameId;
		eventData.EvCode = CustomEventCodes.EndOfRound;
		eventData.Target = data.a[2 - args.ActorNr].id;
		handlers.sendPushNotification({Recipient: data.a[2 - args.ActorNr].id, Message: JSON.stringify({Message: args.Nickname + ' has played ' + eventData.m.mw, CustomData:eventData})});
		return addToEventsCache(args, data);
	} catch (e) { throw e;}
}

function onEndOfGame(args, data) {
	try {
		var eventData = args.Data; // TODO: test args and eventData
		if (eventData.SkipBlocked !== true && eventData.t !== MAX_TURNS_PER_GAME || eventData.t !== data.t + args.ActorNr) {
				throw new PhotonException(WEB_ERRORS.EVENT_FAILURE, 'Custom EndOfGame event: wrong t#', { w: args, d: data });
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
		redeemWordukens(args.UserId, data.a[args.ActorNr - 1].w, args.GameId);
		/*if (args.ActorNr === 2) {
			deleteSharedGroupEntry(getGamesListId(args.UserId), args.GameId);
		}*/
		// push
		var msg = '. Game has ended, ';
		if (data.s === GameStates.EndedDraw) {
			msg += 'Tie!';
		} else if (data.s === GameStates.EndedDraw + args.ActorNr) {
			msg += 'You lost!';
		} else /*if (data.s === GameStates.EndedDraw + 3 - args.ActorNr)*/ {
			msg += 'You won!';
		}
		if (!undefinedOrNull(args.State)) {
			for(var i = 0; i < args.State.ActorList.length; i++) {
				if (args.State.ActorList[i].UserId === data.a[2 - args.ActorNr].id &&
						args.State.ActorList[i].IsActive === true){
					return addToEventsCache(args, data); // skip sending push notification!
				}
			}
		}
		eventData.GameId = args.GameId;
		eventData.EvCode = CustomEventCodes.EndOfGame;
		eventData.Target = data.a[2 - args.ActorNr].id;
		handlers.sendPushNotification({
			Recipient: data.a[2 - args.ActorNr].id,
			Message: JSON.stringify({
				Message: args.Nickname + ' has played ' + eventData.mw + msg,
				CustomData:eventData
			})
		});
		return addToEventsCache(args, data);
	} catch (e) { throw e;}
}

function onNewRound(args, data) {
	if (data.s !== GameStates.Blocked) {
		logException('Unexpected GameState onNewRound (probably 2nd client tried to fix blocked round too late)', { w: args, d: data });
		return data;
		//throw new PhotonException(WEB_ERRORS.EVENT_FAILURE, 'Unexpected GameState onNewRound', { w: args, d: data });
	}
	try {
		var eventData = args.Data; // TODO: test args and eventData
		var newRoundNr = eventData.r; // eventData.m.r + 1;
		data.r[newRoundNr] = { r: eventData.r, gs: eventData.gs, ts: eventData.ts, m: [{}, {}] };
		data.s = GameStates.Playing;
		// TODO: do not presume last cached event is EndOfTurn who caused the block
		if (data.Cache[data.Cache.length - 1][1] !== CustomEventCodes.EndOfTurn){

		}
		// data.Cache[data.Cache.length - 1][0] = args.ActorNr;
		data.Cache[data.Cache.length - 1][1] = CustomEventCodes.EndOfRound;
		data.Cache[data.Cache.length - 1][2] = data.t;//{ m: data.Cache[data.Cache.length - 1][2], r: eventData };
		//data.Cache[data.Cache.length - 1][2].m.t = data.t;
		if (!undefinedOrNull(args.State)) {
			for(var i = 0; i < args.State.ActorList.length; i++) {
				if (args.State.ActorList[i].IsActive === false){
					eventData.EvCode = CustomEventCodes.NewRound;
					eventData.Target = args.State.ActorList[i].UserId;
					eventData.GameId = args.GameId;
					handlers.sendPushNotification({
						Recipient: args.State.ActorList[i].UserId,
						Message: JSON.stringify({
							Message: args.Nickname + ' has played ' + data.Cache[data.Cache.length - 1][2].m.mw + msg,
							CustomData:eventData
						})
					});
				}
			}
		}
		return data;
	} catch (e) {throw e;}
}


function onResign(args, gameData) {
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
		var msg = gameData.a[actorNr - 1].n + ' resigned!';
		if (actorNr === 2 && gameData.gt === 3 && gameData.s < GameStates.Playing) {
			msg = gameData.a[actorNr - 1].n + ' declined the challenge!';
		}
		// send push
		handlers.sendPushNotification({
			Recipient: gameData.a[2 - actorNr].id,
			Message: JSON.stringify({
				Message: msg,
				CustomData: {
					EvCode: CustomEventCodes.Resign,
					GameId: args.GameId,
					Target: gameData.a[2 - actorNr].id
				}
			})
		});
	}
	return gameData;
}


// args = PathEvent webhook args, you need args.EvCode and args.Data (event data).
// data = Room data, modify it but do not delete or overwrite existing properties. this will be saved for you.
function addToEventsCache(args, data) {
	try {
		if (!data.hasOwnProperty('Cache')) {
			data.Cache = [];
		}
		var filter;
		switch (args.EvCode) {
			case CustomEventCodes.EndOfTurn:
			case CustomEventCodes.EndOfGame:
				filter = args.Data.t;
				break;
			case CustomEventCodes.EndOfRound:
				filter = args.Data.m.t;
				break;
			default:
				throw new PhotonException(WEB_ERRORS.EVENT_FAILURE, 'Trying to cache unhandled event', { w: args, d: data });
		}
		for(var i=0; i<data.Cache.length; i++){
			var cv = data.Cache[i];
			if (cv[2] === filter) {
				throw new PhotonException(WEB_ERRORS.EVENT_FAILURE, 'Trying to cache duplicate event', { w: args, d: data });
			}
		}
		// cleanup keys used for push norification
		delete args.Data.Target;
		delete args.Data.EvCode;
		delete args.Data.GameId;
		var cachedEvent = [
			args.ActorNr,
			args.EvCode,
			filter
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
		for(var i=0; i<wordukens.length; i++) {
			itemKey = WORDUKENS_STORE_IDS[wordukens[i].wt - 1];
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
		var itemsToRedeem = [];
		for(var i=0; i<wordukens.length; i++) {
			if (wordukens[i].t === -1) {
				itemsToRedeem.push(WORDUKENS_STORE_IDS[wordukens[i].wt - 1]);
			}
		}
		if (itemsToRedeem.length > 0){
			grantItemsToUser(userId, itemsToRedeem);
		}
	} catch (e) {
		logException('Unexpected:redeemWordukens exception', {err:e, w: wordukens, u: userId, g:gameId});
	}
}
