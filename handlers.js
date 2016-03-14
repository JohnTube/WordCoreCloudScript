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
	'use strict';
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
	'use strict';
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
    'use strict';
    //if (args.c) { // newly created
	createSharedGroup(getGamesListId());
	//}
};

handlers.pollGamesData = function () {
    'use strict';
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
					if (gameList[gameKey].gameData.s === GameStates.UnmatchedPlaying || gameList[gameKey].gameData.s === GameStates.UnmatchedWaiting) {
						if (CheckMatchmakingTimeOut(gameList[gameKey].gameData.ts) 
							|| CheckMatchmakingTimeOut(gameList[gameKey].gameData.c)) { // temporary to delete old games (creation timestamp used to have 'c' key)
							gameList[gameKey].gameData.s = GameStates.MatchmakingTimedOut;
							listToUpdate[listId][gameKey] = null;
						}
					} else if (gameList[gameKey].gameData.s > GameStates.UnmatchedWaiting && gameList[gameKey].gameData.s < GameStates.P1Resigned) {
						//gameList[gameKey].gameData.t / 3
						if (gameList[gameKey].gameData.r.length > 0 && CheckRoundTimeOut(gameList[gameKey].gameData.r[gameList[gameKey].gameData.r.length - 1].ts)) {
							gameList[gameKey].gameData.s = GameStates.TimedOutDraw;
							if (gameList[gameKey].gameData.t % 3 !== 0) {
								gameList[gameKey].gameData.s += (3- gameList[gameKey].gameData.t % 3);
							}
							listToUpdate[listId][gameKey] = gameList[gameKey];
						}
					}
					if (!undefinedOrNull(gameList[gameKey].gameData.a) && // TODO: handle case when undefinedOrNull
						!undefinedOrNull(gameList[gameKey].a[0]) && // TODO: handle case when undefinedOrNull
						gameList[gameKey].gameData.a[0].id === currentPlayerId) {
							data[gameKey] = gameList[gameKey].gameData;
							data[gameKey].pn = 1;
						}
				} else {
					listToUpdate[listId][gameKey] = null; // deleting values that do not contain 'gameData' key, TODO: report and investigate
				}
			} else if (!undefinedOrNull(gameList[gameKey].Creation) 
				&& !undefinedOrNull(gameList[gameKey].Creation.UserId)) {
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
						if (gameList[gameKey].gameData.s === GameStates.UnmatchedPlaying 
							|| gameList[gameKey].gameData.s === GameStates.UnmatchedWaiting) {
								if (CheckMatchmakingTimeOut(gameList[gameKey].gameData.ts) 
									|| CheckMatchmakingTimeOut(gameList[gameKey].gameData.c)) { // temporary to delete old games (creation timestamp used to have 'c' key)
									gameList[gameKey].gameData.s = GameStates.MatchmakingTimedOut;
									listToUpdate[listId][gameKey] = null;
								}
						} else if (gameList[gameKey].gameData.s > GameStates.UnmatchedWaiting 
							&& gameList[gameKey].gameData.s < GameStates.P1Resigned) {
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
							!undefinedOrNull(gameList[gameKey].a[1]) && // TODO: handle case when undefinedOrNull
							gameList[gameKey].gameData.a[1].id === currentPlayerId) {
								data[gameKey] = gameList[gameKey].gameData;
								data[gameKey].pn = 2;
						}
					} else {
						listToUpdate[listId][gameKey] = null; // deleting values that do not contain 'gameData' key, TODO: report and investigate
					}
                } else {
					listToUpdate[getGamesListId()][gameKey] = null; // TODO: report and investigate references to deleted or unsaved games
				}
            }
        }
    }
	for (listId in listToUpdate) {
		if (listToUpdate.hasOwnProperty(listId) && !isEmpty(listToUpdate[listId])){
			updateSharedGroupData(listId, listToUpdate[listId]);
		} 
	}
    return {ResultCode: 0, Data: data};
};

function getDiffData(gameData, clientGame) {
    'use strict';
    var diff = gameData; // temporary
    return diff;
}

handlers.pollData = function (args) {
    'use strict';
    var serverGamesData = handlers.pollGamesData().Data,
        clientGamesList = args.g,
        gameKey = '',
        gameData = {},
        gameState = {},
        data = {u: {}, o: {}, n: {}, ni: {}, ui: {}};
    for (gameKey in serverGamesData) {
        if (serverGamesData.hasOwnProperty(gameKey)) {
            gameData = serverGamesData[gameKey];
            if (undefinedOrNull(clientGamesList) || !clientGamesList.hasOwnProperty(gameKey)) {
                if (gameData.s < GameStates.P1Resigned && gameData.s > GameStates.MatchmakingTimedOut) { data.n[gameKey] = gameData; }
            } else {
				gameState = clientGamesList[gameKey];
                if (gameState.t !== gameData.t || gameState.s !== gameData.s) {
                    data.u[gameKey] = getDiffData(gameData, gameState);
                }
            }
        }
    }
    return {ResultCode: 0, Data: data};
};
