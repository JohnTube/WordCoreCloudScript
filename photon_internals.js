function getGamesListId(playerId) {
    if (undefinedOrNull(playerId)) {
        playerId = currentPlayerId;
    }
    return playerId + '_GamesList';
}

function getCreatorId(gameId) {
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
        updateSharedGroupEntry(getGamesListId(getCreatorId(gameId)), gameId, data);
    } catch (e) { logException(getISOTimestamp(), e, 'saveGameData:' + gameId + ',' + JSON.stringify(data)); throw e; }
}

function stripRoomState(state) {
	delete state.DebugInfo;
	state.ActorList.forEach(function(value, key, myArray) {
    delete value.DEBUG_BINARY;
	});
	return state;
}

handlers.RoomCreated = function (args) {
    try {
        var timestamp = getISOTimestamp(),
            data = {};
        checkWebhookArgs(args, timestamp);
        if (args.Type === 'Create') {
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
    } catch (err) {
        if (err instanceof PhotonException) {
            return {ResultCode: err.ResultCode, Message: err.Message};
        }
        return {ResultCode: 100, Message: JSON.stringify(err)};
    }
};

handlers.RoomClosed = function (args) {
    try {
        var timestamp = getISOTimestamp();
        if (args.Type === 'Close') {
					logException(timestamp, args, 'Unexpected GameClose, Type == Close');
        } else if (args.Type === 'Save') {
						data.State = stripRoomState(args.State);
            saveGameData(args.GameId, data);
        }
        return {ResultCode: 0, Message: 'OK'};
    } catch (e) {
        if (e instanceof PhotonException) {
            return {ResultCode: e.ResultCode, Message: e.Message};
        }
        return {ResultCode: 100, Message: JSON.stringify(e)};
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
        return {ResultCode: 100, Message: JSON.stringify(e)};
    }
};

handlers.RoomEventRaised = function (args) {
    try {
        var timestamp = getISOTimestamp(),
            data = {};
        checkWebhookArgs(args, timestamp);
				if (args.EvCode > CustomEventCodes.InitGame) {
					data = loadGameData(args.GameId);
				}
        onEventReceived(args, data);
        if (!undefinedOrNull(args.State)) {
          data.State = args.State;
        }
				saveGameData(args.GameId, data);
        return {ResultCode: 0, Message: 'OK'};
    } catch (e) {
        if (e instanceof PhotonException) {
            return {ResultCode: e.ResultCode, Message: e.Message};
        }
        return {ResultCode: 100, Message: JSON.stringify(e)};
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
