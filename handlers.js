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
		var data = getPollResponse(args.g);
		return {ResultCode: 0, Data: data};
	} catch (e){
		logException(getISOTimestamp(), e, "Error in onLogin handler");
		createSharedGroup(getGamesListId());
		return {ResultCode: 0};
	}
};

function getPollResponse(clientGamesList) {
	var serverGamesData = pollGamesData(),
	gameKey = '',
	gameData = {},
	gameState = {},
	data = {u: {}, o: [], n: {}, r: {}, ni: {}, ui: {}};
	//logException(getISOTimestamp(), {s:serverGamesData, c:args}, "PollingGameData");
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
						logException(getISOTimestamp(), {s: gameData, c: gameState}, 'Client State > Server State, GameId=' + gameKey);
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
	return data;
}

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
	try {//if (!gameData.hasOwnProperty('Cache')) {return null;} // TODO: remove or add log when moving to prod
	var diff = {}, x = gameData.t - clientGame.t, actorNr = 1;
	if (gameData.a[0].id !== currentPlayerId) {actorNr = 2;}
	var opponentNr = 3 - actorNr, clientRound = clientGame.t / 3;
	if (gameData.s > 6 || gameData.s === GameStates.MatchmakingTimedOut) {
		diff.s = gameData.s;
	}
	if (x === 0) { return diff; }
	else if ( x < 0) {
		return null; }
	var n = x * 2 / 3;
	if (x % 3 !== 0) { n++; }
	diff.e = gameData.Cache.slice(-n);
	return diff;} catch (e) {
		throw e;
	}
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
	}} catch(e) {throw e;}
}

// expects {} in 'g' with <gameID> : {s: <gameState>, t: <turn#>}
handlers.pollData = function (args) {
	try {
		var data = getPollResponse(args.g);
	return {ResultCode: 0, Data: data};} catch(e) {throw e;}
};

// expects [] of gameIDs to delete
handlers.deleteGames = function (gamesToDelete) {
	try {
		deleteOrFlagGames(gamesToDelete);
	return {ResultCode: 0};} catch (e) {throw e;}
};


// expects gameID in 'GameId'
handlers.resign = function (args) {
	try {
		var gameData = loadGameData(args.GameId), actorNr = 1;
		if (currentPlayerId !== getCreatorId(args.GameId)) {
			actorNr = 2;
		}
		if (gameData.a[actorNr - 1].id === currentPlayerId &&
			gameData.s > GameStates.UnmatchedPlaying &&
			gameData.s < GameStates.P1Resigned) {
			gameData.s = GameStates.P2Waiting + actorNr;
			gameData.deletionFlag = actorNr;
			saveGameData(args.g, gameData);
			if (actorNr === 2) {
				deleteSharedGroupEntry(getGamesListId(), args.GameId);
			}
		return {ResultCode: 0, Data:args};
	} else {
		return {ResultCode: 1, Data:args, Message: 'Cannot resign from game'};
	}} catch (e) {throw e;}
};
