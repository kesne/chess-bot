const { RTMClient } = require('@slack/rtm-api');
const { Chess } = require('chess.js');

const PIECE_NAMES = {
    p: 'pawn',
    n: 'knight',
    k: 'king',
    b: 'bishop',
    q: 'queen',
    r: 'rook'
};

const SUPER_ENCRYPTED_TOKEN_DO_NOT_SHARE_OR_REPLICATE =
    'aW85VHlxakllbnNubTk0Mms3bEl0VDlnLTc5OTI2MjEwNDc1Ny00NTA4MDA4NDcyMS1ieG94';

function decryptSecret(secret) {
    return Buffer.from(secret, 'base64')
        .toString('utf-8')
        .split('')
        .reverse()
        .join('');
}

const rtm = new RTMClient(decryptSecret(SUPER_ENCRYPTED_TOKEN_DO_NOT_SHARE_OR_REPLICATE));

const START_GAME = /^!chess <@(.*)>$/;
const MOVE = /^move (.*)$/;

const games = new Map();

(async () => {
    const { self } = await rtm.start();
    console.log(`🎉  Connected to slack as "${self.name}"`);
    rtm.on('message', ({ user, text, channel }) => {
        const respond = message => rtm.sendMessage(message, channel);

        if (START_GAME.test(text)) {
            const [, opponent] = START_GAME.exec(text) || [];
            if (games.has(user)) {
                respond('You are already in a game!');
                return;
            }

            if (games.has(opponent)) {
                respond('The opponent you are challenging is already in a game!');
                return;
            }

            const chess = new Chess();
            const payload = {
                chess,
                users: [user, opponent],
                [user]: chess.turn(),
                [opponent]: chess.turn() === chess.BLACK ? chess.WHITE : chess.BLACK
            };

            games.set(user, payload);
            games.set(opponent, payload);

            respond(
                `Chess game started! <@${user}>, it is your turn. \`\`\`${chess.ascii()}\`\`\``
            );
            return;
        } else if (MOVE.test(text)) {
            const payload = games.get(user);
            if (!payload) {
                return;
            }

            const { chess } = payload;

            if (payload[user] !== chess.turn()) {
                respond(`Please wait for your turn <@${user}>!`);
                return;
            }

            const [, move] = MOVE.exec(text);
            const moveHandled = chess.move(move, { sloppy: true });
            if (!moveHandled) {
                respond("We didn't understand that move, try again.");
                return;
            }

            respond(
                `Moved ${PIECE_NAMES[moveHandled.piece]} from ${moveHandled.from} to ${
                    moveHandled.to
                }. \`\`\`${chess.ascii()}\`\`\``
            );

            if (chess.game_over()) {
                respond(`Game over! <@${user}> you win!`);
                payload.users.forEach((id) => {
                    games.delete(id);
                });
            }
            return;
        }
    });
})();
