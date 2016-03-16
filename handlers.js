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
ROUND_TIME_OUT = 2 /** 24*/ * MATCHMAKING_TIME_OUT; // DEV : 2 hours ==> PROD : 2 days in milliseconds

// only called when turnnumber > -1 && turnnumber < MAX_TURNS_PER_GAME
function CheckRoundTimeOut(timestamp){

	if (!timestamp.includes('.')) { // fixing timestamp
		timestamp = timestamp.substr(0, timestamp.lastIndexOf(':')) + '.' + timestamp.substr(timestamp.lastIndexOf(':') + 1);
	}
	if (Date.now() - new Date(timestamp).getTime() > ROUND_TIME_OUT){
		return true;
	}
	return false;
}

// only called when turnnumber == -1 or == -2 && calling actorNr = 1
function CheckMatchmakingTimeOut(timestamp){

	if (!undefinedOrNull(timestamp)){
		if (!timestamp.includes('.')) { // fixing timestamp
			timestamp = timestamp.substr(0, timestamp.lastIndexOf(':')) + '.' + timestamp.substr(timestamp.lastIndexOf(':') + 1);
		}
		if (Date.now() - new Date(timestamp).getTime() > MATCHMAKING_TIME_OUT){
			return true;
		}
	}
	return false;
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
			if (gameList[gameKey].Creation.UserId === currentPlayerId) {
				if (!undefinedOrNull(gameList[gameKey].gameData)) {
					if (gameList[gameKey].gameData.s === GameStates.UnmatchedPlaying ||
							gameList[gameKey].gameData.s === GameStates.UnmatchedWaiting) {
							if (CheckMatchmakingTimeOut(gameList[gameKey].gameData.ts)) {
								gameList[gameKey].gameData.s = GameStates.MatchmakingTimedOut;
								//listToUpdate[listId][gameKey] = null;
							}
						} else if (gameList[gameKey].gameData.s > GameStates.UnmatchedWaiting &&
											gameList[gameKey].gameData.s < GameStates.P1Resigned) {
								//gameList[gameKey].gameData.t / 3
								if (gameList[gameKey].gameData.r.length > 0 &&
									  CheckRoundTimeOut(gameList[gameKey].gameData.r[gameList[gameKey].gameData.r.length - 1].ts)) {
										gameList[gameKey].gameData.s = GameStates.TimedOutDraw;
										if (gameList[gameKey].gameData.t % 3 !== 0) {
											gameList[gameKey].gameData.s += (3- gameList[gameKey].gameData.t % 3);
										}
										listToUpdate[listId][gameKey] = gameList[gameKey];
									}
								}
								if (!undefinedOrNull(gameList[gameKey].gameData.a) && // TODO: handle case when undefinedOrNull
										!undefinedOrNull(gameList[gameKey].gameData.a[0]) && // TODO: handle case when undefinedOrNull
										gameList[gameKey].gameData.a[0].id === currentPlayerId) {
											data[gameKey] = gameList[gameKey].gameData;
											data[gameKey].pn = 1;
								}
							} else {
								listToUpdate[listId][gameKey] = null; // deleting values that do not contain 'gameData' key
								logException(getISOTimestamp(), gameList[gameKey], 'gameData is undefinedOrNull');
							}
						} else if (!undefinedOrNull(gameList[gameKey].Creation) &&
											 !undefinedOrNull(gameList[gameKey].Creation.UserId)) {
							if (undefinedOrNull(listToLoad[gameList[gameKey].Creation.UserId])) {
								listToLoad[gameList[gameKey].Creation.UserId] = [];
							}
							listToLoad[gameList[gameKey].Creation.UserId].push(gameKey);
						} else {
							logException(getISOTimestamp(), gameList, 'something is undefinedOrNull');
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
				if (!undefinedOrNull(gameList[gameKey].gameData)) {
					if (gameList[gameKey].gameData.s === GameStates.UnmatchedPlaying ||
							gameList[gameKey].gameData.s === GameStates.UnmatchedWaiting) {
							if (CheckMatchmakingTimeOut(gameList[gameKey].gameData.ts)) {
								gameList[gameKey].gameData.s = GameStates.MatchmakingTimedOut;
								listToUpdate[listId][gameKey] = null;
							}
						} else if (gameList[gameKey].gameData.s > GameStates.UnmatchedWaiting &&
											 gameList[gameKey].gameData.s < GameStates.P1Resigned) {
								//gameList[gameKey].gameData.t / 3
								if (gameList[gameKey].gameData.r.length > 0 &&
									CheckRoundTimeOut(gameList[gameKey].gameData.r[gameList[gameKey].gameData.r.length - 1].ts)) {
										gameList[gameKey].gameData.s = GameStates.TimedOutDraw;
										if (gameList[gameKey].gameData.t % 3 !== 0) {
											gameList[gameKey].gameData.s += (3- gameList[gameKey].gameData.t % 3);
										}
										listToUpdate[listId][gameKey] = gameList[gameKey];
									}
								}
								if (!undefinedOrNull(gameList[gameKey].gameData.a) && // TODO: handle case when undefinedOrNull
								!undefinedOrNull(gameList[gameKey].gameData.a[1]) && // TODO: handle case when undefinedOrNull
								gameList[gameKey].gameData.a[1].id === currentPlayerId) {
									data[gameKey] = gameList[gameKey].gameData;
									data[gameKey].pn = 2;
								}
							} else {
								listToUpdate[listId][gameKey] = null; // deleting values that do not contain 'gameData' key
								logException(getISOTimestamp(), gameList[gameKey], 'gameData is undefinedOrNull');
							}
						} else {
							listToUpdate[getGamesListId()][gameKey] = null;
							logException(getISOTimestamp(), null, gameKey + ' save was not found, referenced from ' + currentPlayerId);
						}
					}
				}
	}
	for (listId in listToUpdate) {
		if (listToUpdate.hasOwnProperty(listId) && !isEmpty(listToUpdate[listId])){
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
	var gameKey, userKey, gameData, listToLoad = {}, listToUpdate = {},
	gamesToDelete = getSharedGroupData(getGamesListId(), games);
	for(gameKey in gamesToDelete) {
		if (gamesToDelete.hasOwnProperty(gameKey)) {
			gameData = gamesToDelete[gameKey];
			if (gameData.Creation.UserId === currentPlayerId) {
				if (gameData.gameData.s === GameStates.MatchmakingTimedOut || gameData.deletionFlag === 2) {
					listToUpdate[gameKey] = null;
				} else {
					gameData.deletionFlag = 1;
					listToUpdate[gameKey] = gameData;
				}
			} else {
				if (!listToLoad.hasOwnProperty(gameData.Creation.UserId)) {
					listToLoad[gameData.Creation.UserId] = [];
				}
				listToLoad[gameData.Creation.UserId].push(gameKey);
				listToUpdate[gameKey] = null;
			}
		}
	}
	updateSharedGroupData(getGamesListId(), listToUpdate);
	for(userKey in listToLoad) {
		if (listToLoad.hasOwnProperty(userKey)) {
			listToUpdate = {};
			gamesToDelete = getSharedGroupData(getGamesListId(userKey), listToLoad[userKey]);
			for(gameKey in gamesToDelete) {
				if (gamesToDelete.hasOwnProperty(gameKey)) {
					gameData = gamesToDelete[gameKey];
					if (gameData.deletionFlag === 1) {
						listToUpdate[gameKey] = null;
					} else {
						gameData.deletionFlag = 2;
						listToUpdate[gameKey] = gameData;
					}
				}
			}
			updateSharedGroupData(getGamesListId(), listToUpdate);
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
	if (undefinedOrNull(clientGamesList)) {
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

// expects [] of gameIDs in 'g'
handlers.deleteGames = function (args) {
	deleteOrFlagGames(args.g);
	return {ResultCode: 0};
};

// expects gameID in 'g' & actorNr in 'pn'
handlers.resign = function (args) {
	var listId = getGamesListId(), gameData = getSharedGroupEntry(listId, args.g);
	if (gameData.gameData.a[args.pn - 1].id === currentPlayerId &&
		gameData.gameData.s > GameStates.UnmatchedPlaying &&
		gameData.gameData.s < GameStates.P1Resigned) {
		gameData.gameData.s = GameStates.P2Waiting + args.pn;
		gameData.deletionFlag = args.pn;
		updateSharedGroupEntry(listId, gameData);
		return {ResultCode: 0, Data:args};
	} else {
		return {ResultCode: 1, Data:args, Message: 'Cannot resign from game'};
	}
};
