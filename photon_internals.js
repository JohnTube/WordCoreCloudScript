function getGamesListId(playerId) {
    if (undefinedOrNull(playerId)) {
		throw new PhotonException(WEB_ERRORS.USER_ID_ISSUE, 'getGamesListId: playerId is undefinedOrNull', null);
    } else {
		return playerId + '_GamesList';
	}
}

function getCreatorId(gameId) {
    if (undefinedOrNull(gameId)) {
      return gameId;
    }
		return gameId.split('-')[4];
}

function PhotonException(code, msg, data) {
	this.ResultCode = code;
	this.Message = msg;
	this.Timestamp = getISOTimestamp();
	this.Data = data;
	logException(msg, data, this.Timestamp);
}

PhotonException.prototype = Object.create(Error.prototype);
PhotonException.prototype.constructor = PhotonException;

var LeaveReason = { ClientDisconnect: '0', ClientTimeoutDisconnect: '1', ManagedDisconnect: '2', ServerDisconnect: '3', TimeoutDisconnect: '4', ConnectTimeout: '5',
                    SwitchRoom: '100', LeaveRequest: '101', PlayerTtlTimedOut: '102', PeerLastTouchTimedout: '103', PluginRequest: '104', PluginFailedJoin: '105' };

function loadGameData(gameId) {
	var result;
    try {
		result = getSharedGroupEntry(getGamesListId(getCreatorId(gameId)), gameId);
		return result;
    } catch (e) { logException('loadGameData:' + gameId + ', currentPlayerId=' + currentPlayerId, {err: e, ret: result}); throw e; }
}

function saveGameData(gameId, data) {
    try {
        delete data.pn; // temporary TODO: remove later
        updateSharedGroupEntry(getGamesListId(getCreatorId(gameId)), gameId, data);
    } catch (e) { logException('error saving GameId:' + gameId, {error: e, d:data}); throw e; }
}

function stripRoomState(state) {
	delete state.DebugInfo;
	delete state.CustomProperties;
	state.ActorList.forEach(function(actor) {
			delete actor.DEBUG_BINARY;
		});
	return state;
}

var MAX_GAMES_PER_PLAYER = 10;

var WEB_ERRORS = {
	SUCCESS : 0,
	MISSING_ARG : 1, // Missing Webhook Argument: <arg>
	UNEXPECTED_VALUE : 2,
	// 'Game with GameId=<gameId> already exists.'
	GAME_NOT_FOUND : 5,// 'Could not load the State, Reason=<reason>.'
    MAX_GAMES_REACHED : 110,
    EVENT_FAILURE : 111,
	UNKNOWN_ERROR : 100,
	USER_ID_ISSUE : 6
}

handlers.RoomCreated = function (args) {
    try {
        var data = {};
        if (args.Type === 'Create') {
			var games = getSharedGroupData(getGamesListId(args.UserId));
			var count = 0;
			for(var gameId in games) {
				if (games.hasOwnProperty(gameId) && getCreatorId(gameId) === args.UserId && !undefinedOrNull(games[gameId]) && 
					games[gameId].s >= GameStates.UnmatchedPlaying && games[gameId].s <= GameStates.Blocked) {
					count++;
				}
			}
			if (count > MAX_GAMES_PER_PLAYER) {
				return {ResultCode: WEB_ERRORS.MAX_GAMES_REACHED, Message: 'Maximum allowed games exceeded!'};
			}
            return {ResultCode: WEB_ERRORS.SUCCESS, Message: 'OK'};
        } else if (args.Type === 'Load') {
            data = loadGameData(args.GameId);
            if (undefinedOrNull(data) || undefinedOrNull(data.State)) {
                throw new PhotonException(WEB_ERRORS.GAME_NOT_FOUND, 'Room State=' + args.GameId + ' not found', {Webhook: args, CustomState: data});
            }
            return {ResultCode: WEB_ERRORS.SUCCESS, Message: 'OK', State: data.State};
        } else {
            throw new PhotonException(WEB_ERRORS.UNEXPECTED_VALUE, 'Wrong PathCreate Type=' + args.Type, {Webhook: args});
        }
    } catch (e) {
        if (e instanceof PhotonException) {
            return {ResultCode: e.ResultCode, Message: e.Message};
        }
		logException('RoomCreated', {e: e, args: args});
        return {ResultCode: WEB_ERRORS.UNKNOWN_ERROR, Message: JSON.stringify(e, replaceErrors)};
    }
};

handlers.RoomClosed = function (args) {
    try {
        var data = {};
        if (args.Type === 'Close') {
			logException(args, 'Unexpected GameClose, Type == Close');
        } else if (args.Type === 'Save') {
			data = loadGameData(args.GameId);
			data.State = stripRoomState(args.State);
            saveGameData(args.GameId, data);
        }else {
            throw new PhotonException(WEB_ERRORS.UNEXPECTED_VALUE, 'Wrong PathClose Type=' + args.Type, {Webhook: args});
        }
        return {ResultCode: WEB_ERRORS.SUCCESS, Message: 'OK'};
    } catch (e) {
        if (e instanceof PhotonException) {
            return {ResultCode: e.ResultCode, Message: e.Message};
        }
		logException('RoomClosed', {e: e, args: args});
        return {ResultCode: WEB_ERRORS.UNKNOWN_ERROR, Message: JSON.stringify(e, replaceErrors)};
    }
};

handlers.RoomLeft = function (args) {
    try {
		if ([LeaveReason.ClientTimeoutDisconnect, LeaveReason.ManagedDisconnect, LeaveReason.ServerDisconnect, LeaveReason.ConnectTimeout, 
			 LeaveReason.TimeoutDisconnect, LeaveReason.SwitchRoom, LeaveReason.LeaveRequest, LeaveReason.PlayerTtlTimedOut, 
			 LeaveReason.PeerLastTouchTimedout, LeaveReason.PluginRequest, LeaveReason.PluginFailedJoin].indexOf(args.Reason) > -1) {
			throw new PhotonException(WEB_ERRORS.UNEXPECTED_VALUE, 'Unexpected LeaveReason', args);
		} else if (args.IsInactive === false) {
			throw new PhotonException(WEB_ERRORS.UNEXPECTED_VALUE, 'Unexpected IsInactive flag', args);
		}
        return {ResultCode: WEB_ERRORS.SUCCESS, Message: 'OK'};
    } catch (e) {
        if (e instanceof PhotonException) {
            return {ResultCode: e.ResultCode, Message: e.Message};
        }
		logException('RoomLeft', {e: e, args: args});
        return {ResultCode: WEB_ERRORS.UNKNOWN_ERROR, Message: JSON.stringify(e, replaceErrors)};
    }
};

handlers.RoomEventRaised = function (args) {
    try {
        var data = {};
		if (args.EvCode > CustomEventCodes.InitGame) {
			data = loadGameData(args.GameId);
		}
        data = onEventReceived(args, data);
        if (!undefinedOrNull(args.State)) {
        	data.State = stripRoomState(args.State);
        }
		saveGameData(args.GameId, data);
        return {ResultCode: WEB_ERRORS.SUCCESS, Message: 'OK'};
    } catch (e) {
        if (e instanceof PhotonException) {
			if (e.ResultCode === WEB_ERRORS.EVENT_FAILURE) {
				switch (args.EvCode) {
					case CustomEventCodes.EndOfRound:
						return {ResultCode: e.ResultCode, Message: args.EvCode+','+args.Data.r.r};
						break;
					case CustomEventCodes.NewRound:
						return {ResultCode: e.ResultCode, Message: args.EvCode+','+args.Data.r};
						break;
					case CustomEventCodes.EndOfGame:
					case CustomEventCodes.EndOfTurn:
						return {ResultCode: e.ResultCode, Message: args.EvCode+','+args.Data.t};
						break;
					case CustomEventCodes.WordukenUsed:
						return {ResultCode: e.ResultCode, Message: args.EvCode+','+args.Data.wi};
						break;
					case CustomEventCodes.InitGame:
					case CustomEventCodes.JoinGame:
					case CustomEventCodes.Resign:
					default:
						return {ResultCode: e.ResultCode, Message: String(args.EvCode)};
						break;
				}
			}
            return {ResultCode: e.ResultCode, Message: e.Message};
        }
		logException('RoomEventRaised', {e: e, args: args});
        return {ResultCode: WEB_ERRORS.UNKNOWN_ERROR, Message: JSON.stringify(e, replaceErrors)};
    }
};

handlers.RoomJoined = function (args) { // added to stop receiving ErrorInfo event
    try {
        if (args.ActorNr < 0 || args.ActorNr > 2) {
          throw new PhotonException(WEB_ERRORS.UNEXPECTED_VALUE, "ActorNr < 0 || ActorNr > 2", args);
        }
        return {ResultCode: WEB_ERRORS.SUCCESS, Message: 'OK'};
    } catch (e) {
        if (e instanceof PhotonException) {
            return {ResultCode: e.ResultCode, Message: e.Message};
        }
		logException('RoomJoined', {e: e, args: args});
        return {ResultCode: WEB_ERRORS.UNKNOWN_ERROR, Message: JSON.stringify(e, replaceErrors)};
    }
};


function sendPushNotification(targetId, msg, data, title, icon) {
    try {
        server.SendPushNotification({
            Recipient: targetId,
            Title: title,
            Icon: icon,
            Message: msg,
            CustomData: data
        });
    } catch (e) {
        logException('sendPushNotification', e);
        throw e;
    }
}
