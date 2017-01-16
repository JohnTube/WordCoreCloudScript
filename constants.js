var CustomEventCodes = {Undefined : 0, InitGame : 1, JoinGame : 2, WordukenUsed : 3, EndOfTurn : 4, EndOfRound : 5, EndOfGame : 6, NewRound : 7, Resign: 8},
  MAX_ROUNDS_PER_GAME = 5,
  MAX_TURNS_PER_GAME = 3 * MAX_ROUNDS_PER_GAME,
  MATCHMAKING_TIME_OUT = 60 * 60 * 1000, // 1 hour in milliseconds, 'ClosedRoomTTL' with Photon AsyncRandomLobby ! 3600000
  ROUND_TIME_OUT = 2 * 24 * MATCHMAKING_TIME_OUT, // 172800000
  CLEAN_UP_TIME_OUT = 2 * ROUND_TIME_OUT, // DEV : 1 week ==> PROD : 2 days in milliseconds, 345600000
  MAX_SHARED_GROUP_KEYS_PER_UPDATE = 5,
  MAX_GAMES_PER_PLAYER = 5,
  WEB_ERRORS = {
  	SUCCESS : 0,
  	MISSING_ARG : 1, // Missing Webhook Argument: <arg>
  	UNEXPECTED_VALUE : 2,
  	// 'Game with GameId=<gameId> already exists.'
  	GAME_NOT_FOUND : 5,// 'Could not load the State, Reason=<reason>.'
    MAX_GAMES_REACHED : 110,
    EVENT_FAILURE : 111,
  	UNKNOWN_ERROR : 100,
  	USER_ID_ISSUE : 6,
  },
  ignoredUsers = ["E5B98D6342BE2081", "73BD7B8F4F332064", "AE153C11A8A5AFBD", "36FA5C73684CD689", "8B962390A39AC3B0", "982707EF02AE3898", "3557776C7D92362E", "56F1BEC55BF6D383",
  "C5F4BDF9290B4D7B", "D11CA9D40F20683F", "1C2F249ED7F92165", "DDD2FCBD209A4089", "A87B7470F4AEDC76", "6E4D79BFDB4710D6"],
  WordukenType = { NoWorduken : 0, BestMove : 1, WildCard : 2, SingleColor : 3, Shuffler : 4, Incrementor : 5},
  ALPHABETS = [
	   {A: 1, B: 3, C: 3, D: 2, E: 1, F: 4, G: 2, H: 4, I: 1, J: 8, K: 5, L: 1, M: 3, N: 1, O: 1, P: 3, Q: 10, R: 1, S: 1, T: 1, U: 1, V: 4, W: 4, X: 8, Y: 4, Z: 10},
	   {A: 1, B: 3, C: 3, D: 2, E: 1, F: 4, G: 2, H: 4, I: 1, J: 8, K: 10, L: 1, M:2 , N: 1, O: 1, P: 3, Q: 8, R: 1, S: 1, T: 1, U: 1, V: 4, W: 10, X: 10, Y: 10, Z: 10}
  ],
  GameStates = {
    Undefined : 0,              // 0
    MatchmakingTimedOut : 1,    // 1
    UnmatchedPlaying : 2,       // 2
    UnmatchedWaiting : 3,
    Playing : 4, // 4
    P1Waiting : 5, // 5
    P2Waiting : 6,
	  Blocked : 7,
    P1Resigned : 8,
    P2Resigned : 9,
    TimedOutDraw : 10,
    TimedOutP1Won : 11,
    TimedOutP2Won : 12,
    EndedDraw : 13,
    EndedP1Won : 14,
    EndedP2Won : 15
};
