/*global handlers */
/*global server */
/*global createSharedGroup*/
/*global getGamesListId*/
/*global checkWebRpcArgs*/
/*global currentPlayerId*/
/*global undefinedOrNull*/
/*global getSharedGroupData*/
/*global GameStates*/

var MATCHMAKING_TIME_OUT = 60 * 60 * 1000, // 1 hour in milliseconds, "ClosedRoomTTL" with Photon AsyncRandomLobby !
ROUND_TIME_OUT = 2 /* 24 */* MATCHMAKING_TIME_OUT; // DEV : 2 hours ==> PROD : 2 days in milliseconds


function checkTimeOut(timestamp, THRESHOLD) {
	if (!timestamp.includes('.')) { // fixing timestamp
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
		createSharedGroup(getGamesListId());
	} catch (e){}
};

function pollGamesData() {
	var gameList = {},
		listId = getGamesListId(),
		listToLoad = {},
		listToUpdate = {},
		gameKey = '',
		userKey = '',
		data = {};
		gameList = getSharedGroupData(listId);
		listToUpdate[listId] = {};
	for (gameKey in gameList) {
		if (gameList.hasOwnProperty(gameKey)) {
			userKey = getCreatorId(gameKey);
			if (userKey === currentPlayerId) {
				if (!undefinedOrNull(gameList[gameKey])) {
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
								if (!undefinedOrNull(gameList[gameKey].a) && // TODO: handle case when undefinedOrNull
										gameList[gameKey].a[0].id === currentPlayerId) {
											data[gameKey] = gameList[gameKey];
											data[gameKey].pn = 1;
								} else {
									listToUpdate[listId][gameKey] = null; // deleting values that do not contain 'gameData' key
									logException(getISOTimestamp(), gameList[gameKey], 'actors array is missing or corrupt');
								}
							} else {
								listToUpdate[listId][gameKey] = null; // deleting values that do not contain 'gameData' key
								logException(getISOTimestamp(), gameList[gameKey], 'gameData is undefinedOrNull');
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
		for (gameKey in listToLoad[userKey]) {
			if (gameList.hasOwnProperty(gameKey)) {
				if (!undefinedOrNull(gameList[gameKey])) {
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
								if (!undefinedOrNull(gameList[gameKey].a) && // TODO: handle case when undefinedOrNull
										gameList[gameKey].a[0].id === userKey && // TODO: handle case when undefinedOrNull
										gameList[gameKey].a[1].id === currentPlayerId) {
									data[gameKey] = gameList[gameKey];
									data[gameKey].pn = 2;
								} else {
									listToUpdate[listId][gameKey] = null;
									logException(getISOTimestamp(), gameList[gameKey], 'actors array is missing or corrupt');
								}
							} else {
								listToUpdate[listId][gameKey] = null;
								logException(getISOTimestamp(), gameList[gameKey], 'Game ' + gameKey + ' value is undefinedOrNull');
							}
						} else {
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
	}
	return data;
}

function getDiffData(gameData, clientGame) {
	var diff = gameData; // temporary
	return diff;
}

function deleteOrFlagGames(games) {
	var gameKey, userKey = getCreatorId(gameKey), gameData,
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
				} else {
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
	}
}

// expects {} in 'g' with <gameID> : {s: <gameState>, t: <turn#>}
handlers.pollData = function (args) {
	var serverGamesData = pollGamesData(),
	clientGamesList = args.g,
	gameKey = '',
	gameData = {},
	gameState = {},
	data = {u: {}, o: [], n: {}, ni: {}, ui: {}};
	for (gameKey in serverGamesData) {
		if (serverGamesData.hasOwnProperty(gameKey)) {
			gameData = serverGamesData[gameKey];
			if (undefinedOrNull(clientGamesList) || !clientGamesList.hasOwnProperty(gameKey)) {
				if (gameData.s < GameStates.P1Resigned && gameData.s > GameStates.MatchmakingTimedOut) {
					data.n[gameKey] = gameData;
				}
			} else {
				gameState = clientGamesList[gameKey];
				if (gameState.t !== gameData.t || gameState.s !== gameData.s) {
					data.u[gameKey] = getDiffData(gameData, gameState);
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
};

// expects [] of gameIDs
handlers.deleteGames = function (toDelete) {
	deleteOrFlagGames(toDelete);
	return {ResultCode: 0};
};

// expects gameID in 'g' & actorNr in 'pn'
handlers.resign = function (args) {
	var gameData = loadGameData(args.g);
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
	}
};
