var MATCHMAKING_TIME_OUT = 60 * 60 * 1000, // 1 hour in milliseconds, "ClosedRoomTTL" with Photon AsyncRandomLobby !
ROUND_TIME_OUT = 2 * 24 * MATCHMAKING_TIME_OUT; // DEV : 1 week ==> PROD : 2 days in milliseconds


function checkTimeOut(timestamp, THRESHOLD) {
	if (!timestamp.includes('.')) { // fixing timestamps
		timestamp = timestamp.substr(0, timestamp.lastIndexOf(':')) + '.' + timestamp.substr(timestamp.lastIndexOf(':') + 1);
	}
	if (Date.now() - new Date(timestamp).getTime() > THRESHOLD){
		return true;
	}
	return false;
}

// only called when turnnumber > -1 && turnnumber < MAX_TURNS_PER_GAME
function checkRoundTimeOut(timestamp){
	return checkTimeOut(timestamp, ROUND_TIME_OUT);
}

// only called when turnnumber == -1 or == -2 && calling actorNr = 1
function checkMatchmakingTimeOut(timestamp){
	return checkTimeOut(timestamp, MATCHMAKING_TIME_OUT);
}

handlers.onLogin = function (args, context) {
	try { // temporary
		if (!undefinedOrNull(context)) {
			logException(getISOTimestamp(), context, "new context param in handlers");
		}
		if (args.c === true) {
			createSharedGroup(getGamesListId(args.UserId));
			return {ResultCode: 0};
		}
		var data = getPollResponse(args.g, args.UserId);
		return {ResultCode: 0, Data: data};
	} catch (e){
		if (!undefinedOrNull(e.Error) && e.Error.error === "InvalidSharedGroupId"){
			createSharedGroup(getGamesListId(args.UserId));
		} else {
			logException(getISOTimestamp(), e, "Error in onLogin handler");
		}
		if (!isEmpty(args.g)){
			return {ResultCode:0, Data: {o: Object.getOwnPropertyNames(args.g)}};
		}
		return {ResultCode: 0};
	}
};

function getPollResponse(clientGamesList, userId) {
	var serverGamesData = pollGamesData(userId, clientGamesList),
	gameKey = '',
	gameData = {},
	gameState = {},
	data = {};
	data.a = constructEventsAcks(clientGamesList);
	//logException(getISOTimestamp(), {s:Object.getOwnPropertyNames(serverGamesData), c:Object.getOwnPropertyNames(clientGamesList)}, "getPollResponse");
	for (gameKey in serverGamesData) {
		if (serverGamesData.hasOwnProperty(gameKey)) {
			gameData = serverGamesData[gameKey];
			if (undefinedOrNull(clientGamesList) || !clientGamesList.hasOwnProperty(gameKey)) {
				if (gameData.s < GameStates.P1Resigned && gameData.s > GameStates.MatchmakingTimedOut) {
					delete gameData.State;
					delete gameData.Cache;
					if (!data.hasOwnProperty('n')) { data.n = {}; }
					data.n[gameKey] = gameData;
				}
			} else {
				gameState = clientGamesList[gameKey];
				if (gameState.t !== gameData.t || gameState.s !== gameData.s) {
					var diff = getDiffData(gameData, gameState);
					if (undefinedOrNull(diff)) {
						logException(getISOTimestamp(), {s: gameData, c: gameState}, 'Client State/Turn > Server State/Turn, GameId=' + gameKey);
						if (!data.hasOwnProperty('m')) { data.m = {};}
						data.m[gameKey] = {t: gameData.t, s: gameData.s};
					} else {
						if (!data.hasOwnProperty('u')) { data.u = {};}
						data.u[gameKey] = diff;
					}
				}
			}
		}
	}
	// sending to client array of 'old/outdated' gameIDs that should be deleted [from cache] locally
	if (!isEmpty(clientGamesList)) {
		for (gameKey in clientGamesList) {
			if (clientGamesList.hasOwnProperty(gameKey)) {
				if (!serverGamesData.hasOwnProperty(gameKey)) {
					if (!data.hasOwnProperty('o')) { data.o = [];}
					data.o.push(gameKey);
				}
			}
		}
	}
	return data;
}

function constructEventsAcks(clientData) {
	try {
		if (!isEmpty(clientData)){
			var a;
			for(var game in clientData){
				if (clientData.hasOwnProperty(game) && !isEmpty(clientData[game].e)){
					if (undefinedOrNull(a)) { a = {}; }
					a[game] = [];
					for(var i=0; i<clientData[game].e.length; i++){
						var e = clientData[game].e[i];
						switch (e.EvCode) {
							case CustomEventCodes.InitGame:
							case CustomEventCodes.JoinGame:
							case CustomEventCodes.Resign:
								a[game].push([e.EvCode]);
								break;
							case CustomEventCodes.EndOfRound:
								a[game].push([e.EvCode, e.Data.r.r]);
								break;
							case CustomEventCodes.NewRound:
								a[game].push([e.EvCode, e.Data.r]);
								break;
							case CustomEventCodes.EndOfGame:
							case CustomEventCodes.EndOfTurn:
								a[game].push([e.EvCode, e.Data.t]);
								break;
							case CustomEventCodes.WordukenUsed:
								a[game].push([e.EvCode, e.Data.wi]);
								break;
							default:
								break;
						}
					}
				}
			}
			return a;
		}
	} catch (ex) {
		throw ex;
	}
}

function pollGamesData(userId, clientData) {
	try {
		var gameList = {},
			listId = getGamesListId(userId),
			listToLoad = {},
			listToUpdate = {},
			gameKey = '',
			userKey = '',
			data = {};
			gameList = getSharedGroupData(listId);
			listToUpdate[listId] = {};
			//logException(getISOTimestamp(), gameList, "list of games in " + listId);
			for (gameKey in gameList) {
				if (gameList.hasOwnProperty(gameKey)) {
					userKey = getCreatorId(gameKey);
					if (userKey === currentPlayerId) {
						if (!undefinedOrNull(clientData) && clientData.hasOwnProperty(gameKey) && !undefinedOrNull(clientData[gameKey].e)){
							addMissingEvents(clientData[gameKey].e, gameList[gameKey]);
							listToUpdate[listId][gameKey] = gameList[gameKey];
						}
							if (gameList[gameKey].s === GameStates.UnmatchedPlaying ||
									gameList[gameKey].s === GameStates.UnmatchedWaiting) {
									if (checkMatchmakingTimeOut(gameList[gameKey].ts)) {
										gameList[gameKey].s = GameStates.MatchmakingTimedOut;
									}
								} else if (gameList[gameKey].s > GameStates.UnmatchedWaiting &&
													gameList[gameKey].s < GameStates.P1Resigned) {
													//gameList[gameKey].t / 3
													if (gameList[gameKey].r.length > 0 &&
														  checkRoundTimeOut(gameList[gameKey].r[gameList[gameKey].r.length - 1].ts)) {
															gameList[gameKey].s = GameStates.TimedOutDraw;
															if (gameList[gameKey].t % 3 !== 0) {
																gameList[gameKey].s += (3- gameList[gameKey].t % 3);
															}
															listToUpdate[listId][gameKey] = gameList[gameKey];
														}
											}
										if (!undefinedOrNull(gameList[gameKey].a) &&
												gameList[gameKey].a.length >= 1 &&
												gameList[gameKey].a[0].id === currentPlayerId) {
													data[gameKey] = gameList[gameKey];
													data[gameKey].pn = 1;
										} else {
											listToUpdate[listId][gameKey] = null; // deleting values that do not contain 'gameData' key
											logException(getISOTimestamp(), gameList[gameKey], 'actors array is missing or corrupt');
										}
							} else {
								if (!listToLoad.hasOwnProperty(userKey)) {
									listToLoad[userKey] = [];
								}
								listToLoad[userKey].push(gameKey);
							}
						}
				}
			for (userKey in listToLoad) {
				if (listToLoad.hasOwnProperty(userKey)) {
					listId = getGamesListId(userKey);
					listToUpdate[listId] = {};
					gameList = getSharedGroupData(listId, listToLoad[userKey]);
					//logException(getISOTimestamp(), gameList, "list of games in " + listId);
					for (var i=0; i<listToLoad[userKey].length;i++) {
						gameKey = listToLoad[userKey][i];
						if (gameList.hasOwnProperty(gameKey)) {
								if (!undefinedOrNull(clientData) && clientData.hasOwnProperty(gameKey) && !undefinedOrNull(clientData[gameKey].e)){
									addMissingEvents(clientData[gameKey].e, gameList[gameKey]);
									listToUpdate[listId][gameKey] = gameList[gameKey];
								}
								if (gameList[gameKey].s === GameStates.UnmatchedPlaying ||
										gameList[gameKey].s === GameStates.UnmatchedWaiting) {
										if (checkMatchmakingTimeOut(gameList[gameKey].ts)) {
											gameList[gameKey].s = GameStates.MatchmakingTimedOut;
											listToUpdate[listId][gameKey] = null;
										}
									} else if (gameList[gameKey].s > GameStates.UnmatchedWaiting &&
														 gameList[gameKey].s < GameStates.P1Resigned) {
											//gameList[gameKey].t / 3
											if (gameList[gameKey].r.length > 0 &&
												checkRoundTimeOut(gameList[gameKey].r[gameList[gameKey].r.length - 1].ts)) {
													gameList[gameKey].s = GameStates.TimedOutDraw;
													if (gameList[gameKey].t % 3 !== 0) {
														gameList[gameKey].s += (3- gameList[gameKey].t % 3);
													}
													listToUpdate[listId][gameKey] = gameList[gameKey];
												}
											}
											if (!undefinedOrNull(gameList[gameKey].a) &&
													gameList[gameKey].a.length === 2 &&
													gameList[gameKey].a[0].id === userKey &&
													gameList[gameKey].a[1].id === currentPlayerId) {
														//logException(getISOTimestamp(), gameList[gameKey], 'game added');
												data[gameKey] = gameList[gameKey];
												data[gameKey].pn = 2;
											} else {
												listToUpdate[listId][gameKey] = null;
												logException(getISOTimestamp(), gameList[gameKey], 'actors array is missing or corrupt');
											}
									} else if (listToLoad[userKey].includes(gameKey)) {
										listToUpdate[getGamesListId(userId)][gameKey] = null;
										logException(getISOTimestamp(), null, gameKey + ' save was not found, referenced from ' + currentPlayerId);
									} else {
										logException(getISOTimestamp(), {GameList: gameList, ListToLoad: listToLoad[userKey]}, 'game '+ gameKey + ' from gamesList of user=' + userKey);
									}
								}
							}
				}
				for (listId in listToUpdate) {
					if (listToUpdate.hasOwnProperty(listId) && !isEmpty(listToUpdate[listId])) {
						updateSharedGroupData(listId, listToUpdate[listId]);
					}
				}
				return data;
	} catch (e) {throw e;}
}

function getDiffData(gameData, clientGame) {
	try {//if (!gameData.hasOwnProperty('Cache')) {return null;} // TODO: remove or add log when moving to prod
	var diff = {};
	if (gameData.s !== clientGame.s) {
		switch (clientGame.s) {
			case GameStates.UnmatchedPlaying:
				if (gameData.s === GameStates.UnmatchedWaiting) {
					break;
				} else if (gameData.s === GameStates.MatchmakingTimedOut){
					diff.s = gameData.s;
				}
				else if (gameData.s >= GameStates.Playing) {
					diff.o = {id: gameData.a[1].id, n: gameData.a[1].n, w: gameData.a[1].w };
					if (gameData.s >= GameStates.P1Resigned) {
						diff.s = gameData.s;
					}
				} else {
					return null;
				}
				break;
			case GameStates.UnmatchedWaiting:
				if (gameData.s === GameStates.MatchmakingTimedOut){
					diff.s = gameData.s;
				}
				else if (gameData.s >= GameStates.Playing) {
					diff.o = {id: gameData.a[1].id, n: gameData.a[1].n, w: gameData.a[1].w };
					if (gameData.s >= GameStates.P1Resigned) {
						diff.s = gameData.s;
					}
				} else {
					return null;
				}
				break;
			case GameStates.Playing:
			case GameStates.P1Waiting:
			case GameStates.P2Waiting:
				if (gameData.s >= GameStates.P1Resigned) {
					diff.s = gameData.s;
				} else if (gameData.s <= GameStates.UnmatchedWaiting) {
					return null;
				} else if (gameData.s === GameStates.Blocked) {
					if (gameData.t - clientGame.t < 3) {
						diff.e = gameData.Cache.slice(-1);
						if (diff.e[0][0] !== gameData.t - clientGame.t) {
							diff.e = [gameData.Cache[gameData.Cache.length - 2]];
						}
						return diff;
					}
				}
				break;
			case GameStates.Blocked:
				if (gameData.s === GameStates.Playing){
					if (gameData.t === clientGame.t) {
						diff.e = [[0, CustomEventCodes.NewRound, gameData.Cache[gameData.Cache.length - 1][2].r]];
	          return diff;
					}
				} else if (gameData.s >= GameStates.P1Resigned) {
					diff.s = gameData.s;
				} else if (gameData.s !== GameStates.Blocked){
					return null;
				}
				break;
			default:
			// logException
			return null;
		}
		// TODO: more tests please
	}
	if (gameData.t !== clientGame.t) {
		var n, dR = Math.floor(gameData.t / 3) - Math.floor(clientGame.t / 3) ,
					cD = clientGame.t % 3, sD = gameData.t % 3;
					//logException(getISOTimestamp(), {dr: dR, cd: cD, sd: sD}, 'checking values');
		if (dR === 0) { // same round
			if (cD === 0 && sD !== 0) { // EndOfTurn
				n = 1;
			} else {
				return null;
			}
		} else if (dR > 0) {
			n = dR * 2;
			if (cD % 3 === 0 && sD % 3 !== 0) {
				n++;
			} else if (cD % 3 !== 0 && sD % 3 === 0) {
				n--;
			}
		} else {
			// logException
			return null;
		}
		if (n <= 0 || n > MAX_ROUNDS_PER_GAME * 2) {
			logException(getISOTimestamp(), {c: clientGame, d: gameData}, 'Calculated # of missing moves ('+n+') is unexpected');
			return null;
		}
		diff.e = gameData.Cache.slice(-n);
	}
	return diff;} catch (e) {
		throw e;
	}
}

function deleteOrFlagGames(games, userId) {
	try {
		var gameKey, userKey = getCreatorId(gameKey), gameData,
			listId = getGamesListId(userId), listToLoad = {}, listToUpdate = {},
			gamesToDelete = getSharedGroupData(listId, games);
			listToUpdate[listId] = {};
		for(gameKey in gamesToDelete) {
			if (gamesToDelete.hasOwnProperty(gameKey)) {
				gameData = gamesToDelete[gameKey];
				if (userKey === currentPlayerId) {
					if (gameData.s === GameStates.MatchmakingTimedOut || gameData.deletionFlag === 2) {
						listToUpdate[listId][gameKey] = null;
					} else {
						gameData.deletionFlag = 1;
						listToUpdate[listId][gameKey] = gameData;
					}
				} else {
					if (!listToLoad.hasOwnProperty(userKey)) {
						listToLoad[userKey] = [];
					}
					listToLoad[userKey].push(gameKey);
					listToUpdate[listId][gameKey] = null;
				}
			}
		}
		for(userKey in listToLoad) {
			if (listToLoad.hasOwnProperty(userKey)) {
				listId = getGamesListId(userKey);
				listToUpdate[listId] = {};
				gamesToDelete = getSharedGroupData(listId, listToLoad[userKey]);
				for (var i=0; i<listToLoad[userKey].length;i++) {
					gameKey = listToLoad[userKey][i];
					if (gamesToDelete.hasOwnProperty(gameKey)) {
						gameData = gamesToDelete[gameKey];
						if (gameData.deletionFlag === 1) {
							listToUpdate[listId][gameKey] = null;
						} else {
							gameData.deletionFlag = 2;
							listToUpdate[listId][gameKey] = gameData;
						}
					} else if (listToLoad[userKey].includes(gameKey)) {
						listToUpdate[getGamesListId(userId)][gameKey] = null;
						logException(getISOTimestamp(), null, gameKey + ' save was not found, referenced from ' + currentPlayerId);
					} else {

					}
				}
			}
		}
		for (listId in listToUpdate) {
			if (listToUpdate.hasOwnProperty(listId) && !isEmpty(listToUpdate[listId])) {
				updateSharedGroupData(listId, listToUpdate[listId]);
			}
		}
	} catch(e) {throw e;}
}

// add pending local client cached events to a game before processing polling diff. to return
// events: array of GameEvent webhook like args
// data: gameData
function addMissingEvents(events, data) {
    if (undefinedOrNull(events)) { return; }
		for(var i=0; i<events.length; i++) {
			onEventReceived(events[i], data);
		}
}


// expects {} in 'g' with <gameID> : {s: <gameState>, t: <turn#>}
handlers.pollData = function (args) {
	try {
		var data = getPollResponse(args.g, args.UserId);
		return {ResultCode: 0, Data: data};
	} catch(e) {
		throw e;
	}
};

// expects [] of gameIDs to delete
handlers.deleteGames = function (args) {
	var gamesToDelete;
	try {
		if (args.hasOwnProperty('g')) {
			gamesToDelete = args.g;
		} else {
			gamesToDelete = args.RpcParams; // temporary
		}
		deleteOrFlagGames(gamesToDelete, args.UserId);
		return {ResultCode: 0};
	} catch (e) {
		logException(getISOTimestamp(), {err: e, g: gamesToDelete}, 'deleteGames');
		//throw e;
	}
};


// expects gameID in 'GameId'
handlers.resign = function (args) {
	try {
		var gameData = loadGameData(args.GameId), actorNr = 1;
		if (args.UserId !== getCreatorId(args.GameId)) {
			actorNr = 2;
		}
		if (gameData.a[actorNr - 1].id === args.UserId &&
			gameData.s > GameStates.UnmatchedPlaying &&
			gameData.s < GameStates.P1Resigned) {
			gameData.s = GameStates.Blocked + actorNr;
			gameData.deletionFlag = actorNr;
			saveGameData(args.GameId, gameData);
			if (actorNr === 2) {
				deleteSharedGroupEntry(getGamesListId(args.UserId), args.GameId);
			}
		return {ResultCode: 0, Data:args};
	} else {
		return {ResultCode: 1, Data:args, Message: 'Cannot resign from game'};
	}} catch (e) {throw e;}
};

handlers.fixRound = function (args) {
	try {
		var gameData = loadGameData(args.GameId);
		onNewRound(args, gameData);
		saveGameData(args.GameId, gameData);
		return {ResultCode: 0, Data:{GameId: args.GameId, r: gameData.Cache[gameData.Cache.length - 1][2].r}};
	} catch (e) {throw e;}
};
