function getLengthBonus(word) {
    'use strict';
	var length = word.length, lengthBonus = 0;
	if (length > 4) { lengthBonus += length - 4; } // single point for each Letter > 4
	if (length > 8) { lengthBonus += length - 8; } // double point for each Letter > 8
	if (length > 12) { lengthBonus += length - 12; } // triple point for each Letter > 12
	return lengthBonus;
}

function getMovePoints(word) {
    'use strict';
    var LETTERS_POINTS = {A: 1, B: 3, C: 3, D: 2, E: 1, F: 4, G: 2, H: 4, I: 1, J: 8, K: 5, L: 1, M: 3, N: 1, O: 1, P: 3, Q: 10, R: 1, S: 1, T: 1, U: 1, V: 4, W: 4, X: 8, Y: 4, Z: 10}, i = 0, score = 0;
	word = word.toUpperCase();
	for (i; i < word.length; i += 1) { score +=  LETTERS_POINTS[word.charAt(i)]; }
	return score;
}

var WordukenType = { NoWorduken : 0, BestMove : 1, WildCard : 2, SingleColor : 3, Shuffler : 4, Incrementor : 5};

function addMoveToGame(gameData, actorNr, move) {
    'use strict';
	// TODO : test if move is legit/legal
	gameData.r[move.r].m[actorNr - 1] = move;
	if (move.wt !== 0) {
		gameData.a[actorNr - 1].w[move.wi].v = true; // validate worduken use (if any)
		if (move.wt === WordukenType.Incrementor) { gameData.a[actorNr - 1].m += 1; }
	}
	var mp = getMovePoints(move.mw);
	if (mp > gameData.a[actorNr - 1].p) {
        gameData.a[actorNr - 1].p = mp;
        gameData.a[actorNr - 1].m += 1;
    }
	gameData.a[actorNr - 1].s += (mp + getLengthBonus(move.mw));
	return gameData;
}


var GameStates = {
    Undefined : 0,              // 0
    MatchmakingTimedOut : 1,    // 1
    UnmatchedPlaying : 2,       // 2
    UnmatchedWaiting : 3,
    Playing : 4, // 4
    P1Waiting : 5, // 5
    P2Waiting : 6,
    P1Resigned : 7,
    P2Resigned : 8,
    TimedOutDraw : 9,
    TimedOutP1Won : 10,
    TimedOutP2Won : 11,
    EndedDraw : 12,
    EndedP1Won : 13,
    EndedP2Won : 14
};

function onInitGame(args, data) {
    'use strict';
    var eventData = args.Data,
		gameData = {a: [{id: args.UserId, n: eventData.n, p: 0, s: 0, m: 1, w: eventData.w}],
				s: GameStates.UnmatchedPlaying, t: 0, rg: args.Region, l: eventData.l, gt: eventData.gt, ts: eventData.ts};
    gameData.r = [{gs: eventData.r.gs, ts: eventData.r.ts, r: eventData.r.r, m: [{}, {}]}];
    data.gameData = gameData;
}

function onJoinGame(args, data) {
    'use strict';
    var eventData = args.Data,
	    gameData = data.gameData;
	gameData.s += 2;
	gameData.a.push({id: args.UserId, n: eventData.n, p: 0, s: 0, m: 1, w: eventData.w});
    data.gameData = gameData;
}

function onWordukenUsed(args, data) {
    'use strict';
    var eventData = args.Data, // TODO: test args and eventData
	    gameData = data.gameData;
	// TODO : test if worduken use is legit/legal
	gameData.a[args.ActorNr - 1].w[eventData.wi] = eventData;
    data.gameData = gameData;
}

function onEndOfTurn(args, data) {
    'use strict';
    var eventData = args.Data, // TODO: test args and eventData
	    gameData = addMoveToGame(data.gameData, args.ActorNr, eventData);
    gameData.t += args.ActorNr;
	gameData.s = GameStates.Playing + args.ActorNr;
	// TODO : send push?
}

function onEndOfRound(args, data) {
    'use strict';
    var eventData = args.Data, // TODO: test args and eventData
	    gameData = addMoveToGame(data.gameData, args.ActorNr, eventData.m);
	gameData.r.push(eventData.r);
	gameData.r[eventData.m.r].m = [{}, {}];
    gameData.t += args.ActorNr;
	gameData.s = GameStates.Playing;
	// TODO : send push

}

function onEndOfGame(args, data) {
    'use strict';
    var eventData = args.Data, // TODO: test args and eventData
	    gameData = addMoveToGame(data.gameData, args.ActorNr, eventData);
    gameData.t += args.ActorNr;
	if (gameData.a[0].s === gameData.a[1].s) {
		gameData.s = GameStates.EndedDraw;
	} else if (gameData.a[0].s > gameData.a[1].s) {
		gameData.s = GameStates.EndedP1Won;
	} else {
		gameData.s = GameStates.EndedP2Won;
	}
	// TODO : send push
}


/*****************************************************************************************************************************/

// implement your logic into the following callbacks and do not worry about how to load and save Photon room state
// constraints:
// 1. ONLY update 'data' argument
// 2. do not delete or overwrite existing properties of 'data' argument

// GameData may contain the following properties:
//- Env (Photon Cloud Region, Photon Client AppVersion, Photon AppId, WebhooksVersion, PlayFab TitleId, CloudScriptVersion and Revision, PlayFabServerVersion)
//- RoomOptions
//- Actors (ActorNr: {UserId, Inactive})
//- Creation (Timestamp, UserId=creator, Type=Load/Create)
//- JoinEvents (Timestamp, UserId)
//- LeaveEvents (Timestamp, UserId, Inactive, <Reason:Type>)
//- LoadEvents (Timestamp, UserId)
//- SaveEvents (Timestamp, UserId)
//- State (Photon Room State)


// args = PathCreate, Type='Create' webhook args. you need args.GameId.
// data = Room data, modify it but do not delete or overwrite existing properties. this will be saved for you.
function onGameCreated(args, data) {
    'use strict';
}

// args = PathCreate, Type='Load' webhook args. you need args.GameId.
// data = Room data, modify it but do not delete or overwrite existing properties. this will be saved for you.
function onGameLoaded(args, data) {
    'use strict';
}

// args = PathClose, Type='Close' webhook args. you need args.GameId.
// data = Room data. this will be destroyed and lost.
function beforeGameDeletion(args, data) {
    'use strict';
}

// args = PathClose, Type='Save' webhook args. you need args.GameId. args.State is already added to data.
// data = Room data, modify it but do not delete or overwrite existing properties. this will be saved for you.
function beforeSavingGame(args, data) {
    'use strict';
}

// gameId = GameId of the game
// gameEntry = game entry in the list, content vary
function beforeAddingGameToPlayerList(gameId, data) {
    'use strict';
}

// args = PathJoin webhook args. you need args.ActorNr.
// data = Room data, modify it but do not delete or overwrite existing properties. this will be saved for you.
function onPlayerJoined(args, data) {
    'use strict';
}

// args = PathLeft webhook args. you need args.ActorNr.
// data = Room data, modify it but do not delete or overwrite existing properties. this will be saved for you.
function onPlayerLeft(args, data) {
    'use strict';
}

// args = PathEvent webhook args, you need args.EvCode and args.Data (event data).
// data = Room data, modify it but do not delete or overwrite existing properties. this will be saved for you.
function onEventReceived(args, data) {
    'use strict';
    var CustomEventCodes = {Undefined : 0, InitGame : 1, JoinGame : 2, WordukenUsed : 3, EndOfTurn : 4, EndOfRound : 5, EndOfGame : 6};
    switch (args.EvCode) {
    case CustomEventCodes.InitGame: // args.ActorNr === 1
        onInitGame(args, data);
        break;
    case CustomEventCodes.JoinGame: // args.ActorNr === 2
        onJoinGame(args, data);
        break;
    case CustomEventCodes.WordukenUsed:
        onWordukenUsed(args, data);
        break;
    case CustomEventCodes.EndOfTurn: // args.Data.t % 3 !== 0
        onEndOfTurn(args, data);
        break;
    case CustomEventCodes.EndOfRound: // args.Data.t % 3 === 0
        onEndOfRound(args, data);
        break;
    case CustomEventCodes.EndOfGame: // args.Data.t = MAX_TURNS_PER_GAME
        onEndOfGame(args, data);
        break;
	}
}

// args = PathGameProperties webhook args, you need args.TargetActor and args.Properties.
// data = Room data, modify it but do not delete or overwrite existing properties. this will be saved for you.
function onPlayerPropertyChanged(args, data) {
    'use strict';
}

// args = PathGameProperties webhook args, you need args.Properties.
// data = Room data, modify it but do not delete or overwrite existing properties. this will be saved for you.
function onRoomPropertyChanged(args, data) {
    'use strict';
}

/*global PhotonException */

// change = {type: <>, loaded: <saved/inGame_Value>, read: <current/received_Value>, timestamp: <>}
// args = webhook args
// data = game data
function onEnvChanged(change, args, data) {
    'use strict';
    switch (change.type) {
    case 'AppId': // should not happen
        throw new PhotonException(101, 'AppId mismatch', change.timestamp, {Change: change, Webhook: args, GameData: data});
    case 'AppVersion': // choose to allow or disallow, tip: you may want to update client or server game data
        // throw new PhotonException(101, 'AppVersion mismatch', change.timestamp, {Change: change, Webhook: args, GameData: data});
        break;
    case 'Region': // choose to allow or disallow, tip:  a "hack" may join players from different regions
        // throw new PhotonException(101, 'Region mismatch', change.timestamp, {Change: change, Webhook: args, GameData: data});
        break;
    case 'WebhooksVersion':
        // throw new PhotonException(101, 'WebhooksVersion mismatch', change.timestamp, {Change: change, Webhook: args, GameData: data});
        break;
    case 'TitleId': // should not happen
        throw new PhotonException(101, 'TitleId mismatch', change.timestamp, {Change: change, Webhook: args, GameData: data});
    case 'CloudScriptVersion': // tip: you may want to update client or server game data
        // throw new PhotonException(101, 'CloudScriptVersion mismatch', change.timestamp, {Change: change, Webhook: args, GameData: data});
        break;
    case 'CloudScriptRevision': // tip: you may want to update client or server game data
        // throw new PhotonException(101, 'CloudScriptRevision mismatch', change.timestamp, {Change: change, Webhook: args, GameData: data});
        break;
    case 'PlayFabServerVersion': // you can safely skip this
        // throw new PhotonException(101, 'PlayFabServerVersion mismatch', change.timestamp, {Change: change, Webhook: args, GameData: data});
        break;
    }
}

/*****************************************************************************************************************************/
