function getGamesListId(playerId) {
    if (undefinedOrNull(playerId)) {
        //logException(getISOTimestamp(), null, 'playerId is undefinedOrNull');
		throw new PhotonException(11, 'getGamesListId: playerId is undefinedOrNull', null);
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

function PhotonException(code, msg, timestamp, data) {
	this.ResultCode = code;
	this.Message = msg;
	this.Timestamp = timestamp;
	this.Data = data;
	logException(timestamp, data, msg);
	//this.Stack = (new Error()).stack;
}

PhotonException.prototype = Object.create(Error.prototype);
PhotonException.prototype.constructor = PhotonException;

var LeaveReason = { ClientDisconnect: '0', ClientTimeoutDisconnect: '1', ManagedDisconnect: '2', ServerDisconnect: '3', TimeoutDisconnect: '4', ConnectTimeout: '5',
                    SwitchRoom: '100', LeaveRequest: '101', PlayerTtlTimedOut: '102', PeerLastTouchTimedout: '103', PluginRequest: '104', PluginFailedJoin: '105' };

function checkWebhookArgs(args, timestamp) {
	var msg = 'Missing argument: ';
	if (undefinedOrNull(args.AppId)) {
		throw new PhotonException(1, msg + 'AppId', timestamp, args);
	}
	if (undefinedOrNull(args.AppVersion)) {
		throw new PhotonException(1, msg + 'AppVersion', timestamp, args);
	}
	if (undefinedOrNull(args.Region)) {
		throw new PhotonException(1, msg + 'Region', timestamp, args);
	}
	if (undefinedOrNull(args.GameId)) {
		throw new PhotonException(1, msg + 'GameId', timestamp, args);
	}
	if (undefinedOrNull(args.Type)) {
		throw new PhotonException(1, msg + 'Type', timestamp, args);
	}
	if ((args.Type !== 'Close' && args.Type !== 'Save')) {
		if (undefinedOrNull(args.ActorNr)) {
			throw new PhotonException(1, msg + 'ActorNr', timestamp, args);
		}
		if (undefinedOrNull(args.UserId)) {
			throw new PhotonException(1, msg + 'UserId', timestamp, args);
		}
    if (args.UserId !== currentPlayerId) {
        throw new PhotonException(3, 'currentPlayerId=' + currentPlayerId + ' does not match UserId', timestamp, args);
    }
		if (undefinedOrNull(args.Username) && undefinedOrNull(args.Nickname)) {
			throw new PhotonException(1, msg + 'Username/Nickname', timestamp, args);
		}
	} else {
		if (undefinedOrNull(args.ActorCount)) {
            throw new PhotonException(1, msg + 'ActorCount', timestamp, args);
		}
    if (!undefinedOrNull(args.State2) && !undefinedOrNull(args.State2.ActorList)) {
        if (args.State2.ActorList.length !== args.ActorCount) {
            throw new PhotonException(2, 'ActorCount does not match State2.ActorList.count', timestamp, args);
        }
    }
	}
	switch (args.Type) {
    case 'Load':
        if (undefinedOrNull(args.CreateIfNotExists)) {
            throw new PhotonException(1, msg + 'CreateIfNotExists', timestamp, args);
        } else if (args.CreateIfNotExists === true && args.ActorNr !== 0) {
            throw new PhotonException(9, 'ActorNr=' + args.ActorNr + ' and CreateIfNotExists=true', timestamp, args);
        }
        break;
    case 'Create':
        if (undefinedOrNull(args.CreateOptions)) {
            throw new PhotonException(1, msg + 'CreateOptions', timestamp, args);
        }
        if (args.ActorNr !== 1) {
            throw new PhotonException(2, 'ActorNr != 1 and Type == Create', timestamp, args);
        }
        break;
    case 'Join':
        if (args.ActorNr <= 0) {
            throw new PhotonException(2, 'ActorNr <= 1 and Type == Join', timestamp, args);
        }
        break;
    case 'Player':
        if (undefinedOrNull(args.TargetActor)) {
            throw new PhotonException(1, msg + 'TargetActor', timestamp, args);
        }
        if (undefinedOrNull(args.Properties)) {
            throw new PhotonException(1, msg + 'Properties', timestamp, args);
        }
        if (!undefinedOrNull(args.Username) && undefinedOrNull(args.State)) {
            throw new PhotonException(1, msg + 'State', timestamp, args);
        }
        break;
    case 'Game':
        if (undefinedOrNull(args.Properties)) {
            throw new PhotonException(1, msg + 'Properties', timestamp, args);
        }
        if (!undefinedOrNull(args.Username) && undefinedOrNull(args.State)) {
            throw new PhotonException(1, msg + 'State', timestamp, args);
        }
        break;
    case 'Event':
        if (undefinedOrNull(args.Data)) {
            throw new PhotonException(1, msg + 'Data', timestamp, args);
        }
        if (!undefinedOrNull(args.Username) && undefinedOrNull(args.State)) {
            throw new PhotonException(1, msg + 'State', timestamp, args);
        }
        break;
    case 'Save':
        if (undefinedOrNull(args.State)) {
            throw new PhotonException(1, msg + 'State', timestamp, args);
        }
        if (args.ActorCount <= 0) {
            throw new PhotonException(2, 'ActorCount <= 0 and Type == Save', timestamp, args);
        }
        break;
    case 'Close':
        if (args.ActorCount !== 0) {
            throw new PhotonException(2, 'ActorCount != 0 and Type == Close', timestamp, args);
        }
        break;
    case 'Leave':
        throw new PhotonException(2, 'Deprecated forward plugin webhook!', timestamp, args);
    default:
        if (LeaveReason.hasOwnProperty(args.Type)) {
            if (undefinedOrNull(args.IsInactive)) {
                throw new PhotonException(1, msg + 'IsInactive', timestamp, args);
            }
            if (undefinedOrNull(args.Reason)) {
                throw new PhotonException(1, msg + 'Reason', timestamp, args);
            }
            if (LeaveReason[args.Type] !== args.Reason) { // For some reason Type string does not match Reason code
                throw new PhotonException(2, 'Reason code does not match Leave Type string', timestamp, args);
            }
            if (['1', '100', '103', '105'].indexOf(args.Reason) > -1) { // Unexpected leave reasons
                throw new PhotonException(2, 'Unexpected LeaveReason', timestamp, args);
            }
        } else {
            throw new PhotonException(2, 'Unexpected Type:' + args.Type);
        }
        break;
	}
}

function loadGameData(gameId) {
	var result;
    try {
		result = getSharedGroupEntry(getGamesListId(getCreatorId(gameId)), gameId);
		return result;
    } catch (e) { logException(getISOTimestamp(), {err: e, ret: result}, 'loadGameData:' + gameId + ', currentPlayerId=' + currentPlayerId); throw e; }
}

function saveGameData(gameId, data) {
    try {
        delete data.pn; // temporary TODO: remove later
        updateSharedGroupEntry(getGamesListId(getCreatorId(gameId)), gameId, data);
    } catch (e) { logException(getISOTimestamp(), {error: e, d:data}, 'error saving GameId:' + gameId); throw e; }
}

function stripRoomState(state) {
	/*if (state.DebugInfo.hasOwnProperty('DEBUG_EVENTS_19')){
	state.DebugInfo = state.DebugInfo.DEBUG_EVENTS_19;
	}
	else {
	delete state.DebugInfo;
	}*/
	delete state.DebugInfo;
	delete state.CustomProperties;
	state.ActorList.forEach(function(actor) {
			delete actor.DEBUG_BINARY;
		});
	return state;
}


var MAX_GAMES_PER_PLAYER = 10;

handlers.RoomCreated = function (args) {
    try {
        var timestamp = getISOTimestamp(),
            data = {};
        checkWebhookArgs(args, timestamp);
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
				return {ResultCode: 110, Message: 'Maximum allowed games exceeded!'};
			}
            return {ResultCode: 0, Message: 'OK'};
        } else if (args.Type === 'Load') {
            data = loadGameData(args.GameId);
            if (undefinedOrNull(data) || undefinedOrNull(data.State)) {
                throw new PhotonException(5, 'Room State=' + args.GameId + ' not found', timestamp, {Webhook: args, CustomState: data});
            }
            return {ResultCode: 0, Message: 'OK', State: data.State};
        } else {
            throw new PhotonException(2, 'Wrong PathCreate Type=' + args.Type, timestamp, {Webhook: args});
        }
    } catch (e) {
        if (e instanceof PhotonException) {
            return {ResultCode: e.ResultCode, Message: e.Message};
        }
		logException(getISOTimestamp(), {e: e, args: args}, 'RoomCreated');
        return {ResultCode: 100, Message: JSON.stringify(e, replaceErrors)};
    }
};

handlers.RoomClosed = function (args) {
    try {
        var timestamp = getISOTimestamp(),
						data = {};
        if (args.Type === 'Close') {
					logException(timestamp, args, 'Unexpected GameClose, Type == Close');
        } else if (args.Type === 'Save') {
						data = loadGameData(args.GameId);
						data.State = stripRoomState(args.State);
            saveGameData(args.GameId, data);
        }
        return {ResultCode: 0, Message: 'OK'};
    } catch (e) {
        if (e instanceof PhotonException) {
            return {ResultCode: e.ResultCode, Message: e.Message};
        }
		logException(getISOTimestamp(), {e: e, args: args}, 'RoomClosed');
        return {ResultCode: 100, Message: JSON.stringify(e, replaceErrors)};
    }
};

handlers.RoomLeft = function (args) {
    try {
        var timestamp = getISOTimestamp();
        checkWebhookArgs(args, timestamp);
				if (args.IsInactive === false) {
					logException(timestamp, args, 'Unexpected GameLeave, IsInactive == false');
				}
        return {ResultCode: 0, Message: 'OK'};
    } catch (e) {
        if (e instanceof PhotonException) {
            return {ResultCode: e.ResultCode, Message: e.Message};
        }
		logException(getISOTimestamp(), {e: e, args: args}, 'RoomLeft');
        return {ResultCode: 100, Message: JSON.stringify(e, replaceErrors)};
    }
};

handlers.RoomEventRaised = function (args) {
    try {
        var timestamp = getISOTimestamp(),
            data = {};
        checkWebhookArgs(args, timestamp);
        if (args.ActorNr === 0) {
          logException(getISOTimestamp(), args, "Ignoring cached event resent from server.");
          return {ResultCode: 0, Message: 'OK'};
        }
		if (args.EvCode > CustomEventCodes.InitGame) {
			data = loadGameData(args.GameId);
		}
        data = onEventReceived(args, data);
        if (!undefinedOrNull(args.State)) {
        	data.State = stripRoomState(args.State);
        }
		saveGameData(args.GameId, data);
        return {ResultCode: 0, Message: 'OK'};
    } catch (e) {
        if (e instanceof PhotonException) {
            return {ResultCode: e.ResultCode, Message: e.Message};
        }
		logException(getISOTimestamp(), {e: e, args: args}, 'RoomEventRaised');
        return {ResultCode: 100, Message: JSON.stringify(e, replaceErrors)};
    }
};

handlers.RoomJoined = function (args) { // added to stop receiving ErrorInfo event
    try {
        var timestamp = getISOTimestamp();
        checkWebhookArgs(args, timestamp);
        if (args.ActorNr < 0 || args.ActorNr > 2) {
          throw new PhotonException(5, "ActorNr < 0 || ActorNr > 2", getISOTimestamp(), args);
        }
        return {ResultCode: 0, Message: 'OK'};
    } catch (e) {
        if (e instanceof PhotonException) {
            return {ResultCode: e.ResultCode, Message: e.Message};
        }
		logException(getISOTimestamp(), {e: e, args: args}, 'RoomJoined');
        return {ResultCode: 100, Message: JSON.stringify(e, replaceErrors)};
    }
};

function checkWebRpcArgs(args, timestamp) {
    var msg = 'Missing argument: ';
  	if (undefinedOrNull(args.AppId)) {
  		throw new PhotonException(1, msg + 'AppId', timestamp, args);
  	}
  	if (undefinedOrNull(args.AppVersion)) {
  		throw new PhotonException(1, msg + 'AppVersion', timestamp, args);
  	}
  	if (undefinedOrNull(args.Region)) {
  		throw new PhotonException(1, msg + 'Region', timestamp, args);
  	}
    if (undefinedOrNull(args.UserId)) {
        throw new PhotonException(1, msg + 'UserId', timestamp, args);
    }
}

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
        logException(getISOTimestamp(), e, 'sendPushNotification');
        throw e;
    }
}
