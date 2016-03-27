var MATCHMAKING_TIME_OUT = 60 * 60 * 1000, // 1 hour in milliseconds, "ClosedRoomTTL" with Photon AsyncRandomLobby !
ROUND_TIME_OUT = 7 * 24 * MATCHMAKING_TIME_OUT; // DEV : 1 week ==> PROD : 2 days in milliseconds


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

handlers.onLogin = function (args) {
	try { // temporary
		if (args.c === true) {
			createSharedGroup(getGamesListId());
			return {ResultCode: 0};
		}
		var serverGamesData = pollGamesData(),
		clientGamesList = args.g,
		gameKey = '',
		gameData = {},
		gameState = {},
		data = {u: {}, o: [], n: {}, r: {}, ni: {}, ui: {}};
		//logException(getISOTimestamp(), {s:serverGamesData, c:args}, "PollingGameData_OnLogin");
		for (gameKey in serverGamesData) {
			if (serverGamesData.hasOwnProperty(gameKey)) {
				gameData = serverGamesData[gameKey];
				if (undefinedOrNull(clientGamesList) || !clientGamesList.hasOwnProperty(gameKey)) {
					if (gameData.s < GameStates.P1Resigned && gameData.s > GameStates.MatchmakingTimedOut) {
						delete gameData.State;
						delete gameData.Cache;
						data.n[gameKey] = gameData;
					}
				} else {
					gameState = clientGamesList[gameKey];
					if (gameState.t !== gameData.t || gameState.s !== gameData.s) {
						var diff = getDiffData(gameData, gameState);
						if (undefinedOrNull(diff)) {
							delete gameData.State;
							delete gameData.Cache;
							data.r[gameKey] = gameData;
						} else {
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
						data.o.push(gameKey);
					}
				}
			}
		}
		return {ResultCode: 0, Data: data};
	} catch (e){
		logException(getISOTimestamp(), e, "Error in onLogin handler");
		createSharedGroup(getGamesListId());
		return {ResultCode: 0};
	}
};

function pollGamesData() {
	try {
	var gameList = {},
		listId = getGamesListId(),
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
							listToUpdate[getGamesListId()][gameKey] = null;
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
	try {if (!gameData.hasOwnProperty('Cache')) {return null;} // TODO: remove or add log when moving to prod
	var diff = {}, x = gameData.t - clientGame.t, actorNr = 1;
	if (gameData.a[0].id !== currentPlayerId) {actorNr = 2;}
	var opponentNr = 3 - actorNr;
	if (x > 0) {
		if (gameData.s === clientGame.s) {
				return null;
		}
		diff.s = gameData.s;
		if (x === opponentNr) { // player should be missing one opponent move
			if (gameData.t % 3 === 0 && clientGame.s === GameStates.Playing + actorNr) {
					// player should be missing last move in a round
					diff.e = gameData.Cache[actorNr];
			} else if (gameData.t % 3 === opponentNr && clientGame.s === GameStates.Playing) {
					// player should be missing first move in a round
					diff.e = gameData.Cache[actorNr];
			}
			return null;
		} else if (x === 2 * opponentNr && clientGame.s === GameStates.Playing + actorNr && gameData.t % 3 === opponentNr) {
				// player should be missing two opponent moves
				diff.e = gameData.Cache[actorNr];
		} else {
			return null;
		}
		diff.t = gameData.t;
	} else if (x < 0) {
		throw new PhotonException(5, "Unexpected: clientTurnNr > serverTurnNr", getISOTimestamp(), { serverData: gameData, clientData: clientGame });
	}
	else if (gameData.s !== clientGame.s) {
		diff.s = gameData.s;
		if (clientGame.s === GameStates.Playing || clientGame.s === GameStates.P1Waiting) { // player should be missing join event
			diff.e = gameData.Cache[actorNr];
		}
	}
	return diff;} catch (e) {}

}

function deleteOrFlagGames(games) {
	try {var gameKey, userKey = getCreatorId(gameKey), gameData,
		listId = getGamesListId(), listToLoad = {}, listToUpdate = {},
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
			for(gameKey in listToLoad[userKey]) {
				if (gamesToDelete.hasOwnProperty(gameKey)) {
					gameData = gamesToDelete[gameKey];
					if (gameData.deletionFlag === 1) {
						listToUpdate[listId][gameKey] = null;
					} else {
						gameData.deletionFlag = 2;
						listToUpdate[listId][gameKey] = gameData;
					}
				} else if (listToLoad[userKey].hasOwnProperty(gameKey)) {
					listToUpdate[getGamesListId()][gameKey] = null;
					logException(getISOTimestamp(), null, gameKey + ' save was not found, referenced from ' + currentPlayerId);
				}
			}
		}
	}
	for (listId in listToUpdate) {
		if (listToUpdate.hasOwnProperty(listId) && !isEmpty(listToUpdate[listId])) {
			updateSharedGroupData(listId, listToUpdate[listId]);
		}
	}} catch(e) {}

}

// expects {} in 'g' with <gameID> : {s: <gameState>, t: <turn#>}
handlers.pollData = function (args) {
	try {var serverGamesData = pollGamesData(),
	clientGamesList = args.g,
	gameKey = '',
	gameData = {},
	gameState = {},
	data = {u: {}, n: {}, r: {}, ni: {}, ui: {}}; // TODO: remove r, n
	logException(getISOTimestamp(), {s:serverGamesData, c:args}, "PollingGameData");
	for (gameKey in serverGamesData) {
		if (serverGamesData.hasOwnProperty(gameKey)) {
			gameData = serverGamesData[gameKey];
			if (undefinedOrNull(clientGamesList) || !clientGamesList.hasOwnProperty(gameKey)) {
				if (gameData.s < GameStates.P1Resigned && gameData.s > GameStates.MatchmakingTimedOut) {
					delete gameData.State;
					delete gameData.Cache;
					data.n[gameKey] = gameData;
				}
			} else {
				gameState = clientGamesList[gameKey];
				if (gameState.t !== gameData.t || gameState.s !== gameData.s) {
					var diff = getDiffData(gameData, gameState);
					if (undefinedOrNull(diff)) {
						delete gameData.State;
						delete gameData.Cache;
						data.r[gameKey] = gameData;
					} else {
						data.u[gameKey] = diff;
					}
				}
			}
		}
	}
	return {ResultCode: 0, Data: data};} catch(e) {throw e;}

};

// expects d:[] of gameIDs to delete, c:{<gameId>:[[cachedEvent]]} to clear
handlers.deleteGames = function (args) {
	try {deleteOrFlagGames(args.d);
	var gamesData = pollGamesData();
	var cachePerGame = args.c;
	for(var game in cachePerGame) {
		if (cachePerGame.hasOwnProperty(game)) {
			var cachedEvents = cachePerGame[game];
			for(var i = 0; i < cachedEvents.length; i++) {
				var cachedEvent = cachedEvents[i];
				gamesData[game] = removeFromEventsCache({EvCode: cachedEvent[1], ActorNr: 3 - cachedEvent[0], Data: cachedEvent[2]}, gamesData[game]);
				saveGameData(game, gamesData[game]); // TODO; update batch
			}
		}
	}
	return {ResultCode: 0};} catch (e) {throw e;}

};

// expects gameID in 'g' & actorNr in 'pn'
handlers.resign = function (args) {
	try {var gameData = loadGameData(args.g);
	if (gameData.a[args.pn - 1].id === currentPlayerId &&
		gameData.s > GameStates.UnmatchedPlaying &&
		gameData.s < GameStates.P1Resigned) {
		gameData.s = GameStates.P2Waiting + args.pn;
		//gameData.deletionFlag = args.pn;
		saveGameData(args.g, gameData);
		/*if (args.pn === 2) {
			deleteSharedGroupEntry(getGamesListId(), args.g);
		}*/
		return {ResultCode: 0, Data:args};
	} else {
		return {ResultCode: 1, Data:args, Message: 'Cannot resign from game'};
	}} catch (e) {throw e;}

};
