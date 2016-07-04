// http://stackoverflow.com/a/21273362/1449056
function undefinedOrNull(variable) {	 return variable === undefined || variable === null; } //return variable == null;

// checks to see if an object has any properties
// Returns true for empty objects and false for non-empty objects
function isEmpty(obj) {
	// Object.getOwnPropertyNames(obj).length vs. Object.keys(obj).length
	// http://stackoverflow.com/a/22658584/1449056
	return (undefinedOrNull(obj) || Object.getOwnPropertyNames(obj).length === 0);
}

function isString(obj) {
    return (typeof obj === 'string' || obj instanceof String);
}

function getISOTimestamp() {
    return (new Date()).toISOString() + Math.random();
}

function replaceErrors(key, value) {
    if (value instanceof Error) {
        var error = {};
        Object.getOwnPropertyNames(value).forEach(function (key) {
            error[key] = value[key];
        });
        return error;
    }
    return value;
}

function logException(message, data, timestamp) {
	if (undefinedOrNull(timestamp)) { timestamp = getISOTimestamp(); }
	http.request('http://logs-01.loggly.com/inputs/47d0eb9f-eb72-49a3-8921-730df6ea180c/tag/PlayFab/', 'post',
		JSON.stringify({
			ts: timestamp,
			msg: message,
			d: data
		}, replaceErrors),
		'application/json');
}

function createSharedGroup(id) {
		try { server.CreateSharedGroup({SharedGroupId : id});
    } catch (e) { /*logException('createSharedGroup:' + id, e);*/throw e; }
}

var MAX_SHARED_GROUP_KEYS_PER_UPDATE = 5;

function updateSharedGroupData(id, data) {
    var key, stringData = {};
    try {
		if (Object.keys(data).length <= MAX_SHARED_GROUP_KEYS_PER_UPDATE) {
			for (key in data) {
				if (data.hasOwnProperty(key)) {
					if (!undefinedOrNull(data[key])) {
						stringData[key] = JSON.stringify(data[key]);
					} else {
						stringData[key] = data[key];
					}
				}
			}
			key = server.UpdateSharedGroupData({ SharedGroupId: id, Data: stringData });
		} else { // updating per batch of MAX_SHARED_GROUP_KEYS_PER_UPDATE
			var i = 0;
			for (key in data) {
				if (data.hasOwnProperty(key)) {
					if (!undefinedOrNull(data[key])) {
						stringData[key] = JSON.stringify(data[key]);
					} else {
						stringData[key] = data[key];
					}
					i++;
					if (i === MAX_SHARED_GROUP_KEYS_PER_UPDATE) {
						key = server.UpdateSharedGroupData({ SharedGroupId: id, Data: stringData });
						i = 0;
						stringData = {};
					}
				}
			}
			if (i > 0) {
				key = server.UpdateSharedGroupData({ SharedGroupId: id, Data: stringData });		
			}
		}
    } catch (e) { logException('updateSharedGroupData(' + id + ', ' + JSON.stringify(stringData) + ')', {ret: key, err: e}); throw e; }
}

function getSharedGroupData(id, keys) {
		var data = {}, key;
    try {
        if (undefinedOrNull(keys)) {
            data = server.GetSharedGroupData({ SharedGroupId: id }).Data;
        } else {
            data = server.GetSharedGroupData({ SharedGroupId: id, Keys: keys }).Data;
        }
        for (key in data) {
            if (data.hasOwnProperty(key)) {
                data[key] = JSON.parse(data[key].Value); // 'LastUpdated' and 'Permission' properties are overwritten
            }
        }
        return data;
    } catch (e) { 
		if (!undefinedOrNull(e.Error) && e.Error.error === 'InvalidSharedGroupId' && id === getGamesListId(currentPlayerId)) {
			logException('sharedGroup '+id+' not found, creating it');
			createSharedGroup(id);
			return {};
		}
		logException('getSharedGroupData:' + id + ',' + JSON.stringify(keys), {ret: data, err: e}); 
		throw e; 
	}
}

function deleteSharedGroup(id) {
	var result;
    try {
		result = server.DeleteSharedGroup({SharedGroupId : id});
		return result;
	} catch (e) {
		logException('deleteSharedGroup:' + id, {err: e, ret: result}); throw e;
	}
}

function getSharedGroupEntry(id, key) {
	var result;
    try {
		result = getSharedGroupData(id, [key])[key];
		return result;
	} catch (e) { logException('getSharedGroupEntry:' + id + ',' + key, {err: e, ret: result}); throw e; }
}

function updateSharedGroupEntry(id, key, value) {
    try {
        var data = {};
        data[key] = value;
        return updateSharedGroupData(id, data);
    } catch (e) { logException('updateSharedGroupEntry:' + id + ',' + key + ',' + value, e); throw e; }
}

function deleteSharedGroupEntry(id, key) {
    try { return updateSharedGroupEntry(id, key, null); } catch (e) { logException('deleteSharedGroupEntry:' + id + ',' + key, e); throw e; }
}
