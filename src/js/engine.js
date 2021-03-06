'use strict';

function Engine() {

    let self = this;

    self.gametype_wwf = "wwf";
    self.gametype_scrabble = "scrabble";
    // [letter (* is Joker), points for letter, number of tiles]
    self.wwf_letters = [["a", 1, 9], ["b", 4, 2], ["c", 4, 2], ["d", 2, 5], ["e", 1, 13],
        ["f", 4, 2], ["g", 3, 3], ["h", 3, 4], ["i", 1, 8], ["j", 10, 1],
        ["k", 5, 1], ["l", 2, 4], ["m", 4, 2], ["n", 2, 5], ["o", 1, 8],
        ["p", 4, 2], ["q", 10, 1], ["r", 1, 6], ["s", 1, 5], ["t", 1, 7],
        ["u", 2, 4], ["v", 5, 2], ["w", 4, 2], ["x", 8, 1], ["y", 3, 2],
        ["z", 10, 1], ["*", 0, 2]];

    self.scrabble_letters = [["a", 1, 10], ["b", 4, 2], ["c", 4, 2], ["d", 2, 5], ["e", 1, 12],
        ["f", 4, 2], ["g", 3, 3], ["h", 4, 3], ["i", 1, 9], ["j", 10, 1],
        ["k", 5, 1], ["l", 1, 4], ["m", 3, 2], ["n", 1, 6], ["o", 1, 7],
        ["p", 4, 2], ["q", 10, 1], ["r", 1, 6], ["s", 1, 5], ["t", 1, 7],
        ["u", 2, 4], ["v", 4, 2], ["w", 4, 2], ["x", 8, 1], ["y", 4, 2],
        ["z", 10, 1], ["*", 0, 2]];

    self.racksize = 7;
    self.lmults = [1, 2, 3, 1, 1];  // letter multipliers by index
    self.wmults = [1, 1, 1, 2, 3];  // word multipliers by index
    self.maxwpoints = [10, 15, 20, 50, 999];   // maximum word score for each level
    self.bx = 15;                   //board width
    self.by = 15;                   //board height
    self.letrange = "[a-z]";
    self.ASCII_A = 65;
    self.ASCII_a = 97;
    self.ASCII_z = 122;
    self.letpool = [];
    self.letscore = [];
    self.g_wstr = [];

    //---------------------------------------------------------------------------
    self.validWord = function (word) {
        if (word.length < 2)
            return true;
        return self.g_wstr[word.length - 2].indexOf("_" + word + "_") > -1;
    };

    //---------------------------------------------------------------------------
    self.init = function (gametype) {
        let i, j, letinfo;

        self.gametype = gametype;
        if (gametype === self.gametype_scrabble) {
            self.letters = self.scrabble_letters;
            self.allLettersBonus = 50;
            self.boardmults = new SCRBonusesLayout().init();
        } else {
            self.letters = self.wwf_letters;
            self.allLettersBonus = 35;
            self.boardmults = new WWFBonusesLayout().init();
        }

        for (i = 0; i < self.letters.length; i++) {
            letinfo = self.letters[i];
            self.letscore[letinfo[0]] = letinfo[1];
            for (j = 0; j < letinfo[2]; j++) {
                self.letpool.push(letinfo[0]);
            }
        }
        self.shufflePool();

        return self;
    };

    //---------------------------------------------------------------------------
    self.buildBoardHTML = function () {
        let i, j, mults = ["", "DL", "TL", "DW", "TW"], mult,
            html = "<table id='board' class='table table-bordered'>",
            st = self.getStartXY();

        // let row = "<tr><td class='redips-mark'></td>";
        let row = "<tr>";
        for (i = 0; i < self.bx; i++) {
            row += "<td class='redips-mark'>";
            row += String.fromCharCode(self.ASCII_A + i);
            row += "</td>";
        }
        row += "<td class='redips-mark'></td></tr>";

        html += row;
        for (i = 0; i < self.by; i++) {
            // html += "<tr><td class='redips-mark'>" + (i + 1) + "</td>";
            html += "<tr>";
            for (j = 0; j < self.bx; j++) {
                html += "<td id='c" + j + "_" + i + "' ";
                mult = "";
                if (j === st.x && i === st.y)
                    mult = "ST";
                else
                    mult = mults[self.boardmults[j][i]];
                if (mult !== "")
                    mult = "class='" + mult + "'";
                html += mult + "></td>";
            }
            html += "<td class='redips-mark'>" + (i + 1) + "</td></tr>";
            // html += "</tr>";
        }
        // html += row;
        return html + "</table>";
    };

    //---------------------------------------------------------------------------
    self.getStartXY = function () {
        let fx = Math.round(self.bx / 2) - 1,
            fy = Math.round(self.by / 2) - 1;
        return {x: fx, y: fy};
    };

    //---------------------------------------------------------------------------
    self.shufflePool = function () {
        let i, total = self.letpool.length;
        for (i = 0; i < total; i++) {
            let rnd = Math.floor((Math.random() * total)),
                c = self.letpool[i];
            self.letpool[i] = self.letpool[rnd];
            self.letpool[rnd] = c;
        }
    };

    //---------------------------------------------------------------------------
    self.takeLetters = function (existing) {
        let poolsize = self.letpool.length;
        if (poolsize === 0)
            return existing;

        let needed = self.racksize - existing.length;
        if (needed > poolsize)
            needed = poolsize;
        let letters = self.letpool.slice(0, needed).join("");
        self.letpool.splice(0, needed);
        return existing + letters;
    };

    //---------------------------------------------------------------------------
    self.getWordScore = function (binfo, wordinfo) {
        let xdir = (wordinfo.xy === "x"),
            max = xdir ? self.bx : self.by,
            dx = xdir ? 1 : 0,
            dy = 1 - dx,
            ps = wordinfo.ps,
            owords = [], // list of valid orthogonal words created with this move
            wscore = 0,  // word score
            oscore = 0,  // orthogonal created words score
            wordmult = 1,
            lscr, lseq, bonus, ows, seqc = 0, x, y;

        if (xdir) {
            x = wordinfo.ps;
            y = wordinfo.ay;
        } else {
            x = wordinfo.ax;
            y = wordinfo.ps;
        }

        while (ps < max) {
            if (binfo.board[x][y] === "" && seqc < wordinfo.seq.length) {
                lscr = wordinfo.lscrs[seqc];
                lseq = wordinfo.seq[seqc];
                ows = self.getOrthWordScore(binfo, lseq, lscr, x, y, dx, dy);
                if (ows.score === -1) {
                    return -1;
                }

                if (ows.score > 0)
                    owords.push(ows.word);

                bonus = self.boardmults[x][y];
                wordmult *= self.wmults[bonus];
                lscr *= self.lmults[bonus];
                if (self.lmults[bonus] > 1)
                    wordinfo.lmults++;
                wscore += lscr;
                oscore += ows.score;
                seqc++;
            } else if (binfo.board[x][y] === "" && seqc === wordinfo.seq.length) {
                break;
            } else {
                wscore += binfo.boardp[x][y];
            }
            x += dx;
            y += dy;
            ps++;
        }

        wordinfo.wordmult = wordmult;
        wordinfo.owords = owords;
        wscore *= wordmult;

        if (wordinfo.seq.length === self.racksize)
            wscore += self.allLettersBonus;

        return wscore + oscore;
    };

    //---------------------------------------------------------------------------
    self.doPlacementScoring = function (binfo, isplacement, dx, dy, minx, maxx, miny, maxy, worderrs) {
        let i, x, y, xy,
            numl = (dx === 1) ? maxx - minx + 1 : maxy - miny + 1,
            px = minx - dx,
            py = miny - dy,
            word = "",
            wordmult = 1,
            wscore = 0, // word score
            oscore = 0, // score from orthogonal created words
            words = [], // array of word and orthogonal words created
            ltr, bonus, lscr, orthinfo,
            mbx = self.bx, mby = self.by;

        for (i = 0; i < numl; i++) {
            x = px + dx;
            y = py + dy;

            ltr = binfo.board[x][y];
            if (ltr === "") {
                return {msg: "Invalid placement (spaces in word)"};
            }

            xy = x + "_" + y;
            if (xy in isplacement) {
                // check if orthogonal word created
                lscr = isplacement[xy].lsc;
                orthinfo = self.getOrthWordScore(binfo, ltr, lscr, x, y, dx, dy);

                // Add score of newly placed tile
                bonus = self.boardmults[x][y];
                lscr *= self.lmults[bonus];
                wscore += lscr;
                wordmult *= self.wmults[bonus];

                if (orthinfo.score === -1) {
                    if (worderrs !== "")
                        worderrs += ", ";
                    worderrs += orthinfo.word.toUpperCase();
                } else if (orthinfo.score > 0) {
                    oscore += orthinfo.score;
                    words.push(orthinfo.word);
                }
            } else {
                wscore += binfo.boardp[x][y];
            }
            word += ltr;
            px += dx;
            py += dy;
        }

        // Add letters from board before placement
        let xpre = minx - dx,
            ypre = miny - dy;

        while (xpre >= 0 && ypre >= 0 && binfo.board[xpre][ypre] !== "") {
            ltr = binfo.board[xpre][ypre];
            wscore += binfo.boardp[xpre][ypre];
            word = ltr + word;
            xpre -= dx;
            ypre -= dy;
        }

        let xpst = maxx + dx,
            ypst = maxy + dy;
        while (xpst < mbx && ypst < mby && binfo.board[xpst][ypst] !== "") {
            ltr = binfo.board[xpst][ypst];
            wscore += binfo.boardp[xpst][ypst];
            word += ltr;
            xpst += dx;
            ypst += dy;
        }

        words.push(word);
        let score = wscore * wordmult + oscore;
        if (binfo.placement.length === self.racksize)
            score += self.allLettersBonus;

        return {
            word: word, oscore: oscore, score: score,
            words: words, msg: "", worderrs: worderrs
        };
    };

    //---------------------------------------------------------------------------
    self.checkValidPlacement = function (binfo) {

        if (binfo.placement.length === 0) {
            return {msg: "No letters were placed"};
        }

        let isplacement = {},
            worderrs = "",
            lplayed = "",
            minx = binfo.placement[0].x,
            miny = binfo.placement[0].y,
            maxx = minx,
            maxy = miny,
            dx = 0, dy = 0,
            sp = self.getStartXY(), // In case of first placement
            onStar = false,
            mbx = self.bx, mby = self.by,
            i, pl;

        for (i = 0; i < binfo.placement.length; i++) {
            pl = binfo.placement[i];
            if (pl.ltr === "*") {
                return {msg: "Please select a letter for the blank tile"};
            }

            lplayed += pl.ltr;

            if (pl.x === sp.x && pl.y === sp.y)
                onStar = true;

            isplacement[pl.x + "_" + pl.y] = pl;

            if (minx > pl.x)
                minx = pl.x;

            if (maxx < pl.x)
                maxx = pl.x;

            if (miny > pl.y)
                miny = pl.y;

            if (maxy < pl.y)
                maxy = pl.y;
        }

        if (miny < maxy)
            dy = 1;

        if (minx < maxx)
            dx = 1;

        if (dx === 1 && dy === 1)
            return {msg: "Word must be horizontal or vertical"};

        if (binfo.board_empty && !onStar)
            return {msg: "The first word must be on the star"};

        if (dx === 0 && dy === 0) {
            // only one letter was placed
            if (minx > 0 && binfo.board[minx - 1][miny] !== "" ||
                minx < mbx - 1 && binfo.board[minx + 1][miny] !== "")
                dx = 1;
            else if (miny > 0 && binfo.board[minx][miny - 1] !== "" ||
                miny < mby - 1 && binfo.board[minx][miny + 1] !== "")
                dy = 1;
            else {
                return {msg: lplayed.toUpperCase() + " is not connected to a word"};
            }
        }

        let scoring = self.doPlacementScoring(binfo, isplacement, dx, dy, minx, maxx, miny, maxy, worderrs);
        if (scoring.msg !== "") {
            return {msg: scoring.msg};
        }

        worderrs = scoring.worderrs;

        if (!self.validWord(scoring.word)) {
            if (worderrs !== "")
                worderrs += ", ";
            worderrs += scoring.word.toUpperCase();
        }

        if (worderrs !== "") {
            worderrs += " not found in dictionary";
            return {msg: worderrs};
        }

        if (!binfo.board_empty && scoring.oscore === 0 && scoring.word.length === binfo.placement.length) {
            // No orthogonal words created and no extension to existing
            // word created - this means that the new word isn't connected
            // to anything.
            return {msg: "Word not connected"};
        }

        // return {played: lplayed, score: scoring.score, words: scoring.words, msg: ""};
        return {score: scoring.score, words: scoring.words, msg: ""};
    };

    //---------------------------------------------------------------------------
    self.getOrthWordScore = function (binfo, lseq, lscr, x, y, dx, dy) {
        let wordmult = 1,
            score = 0,
            xsave = x,
            ysave = y,
            lsave = binfo.board[x][y],
            ssave = binfo.boardp[x][y],
            bonus = self.boardmults[x][y],
            orthword = "";

        wordmult *= self.wmults[bonus];
        lscr *= self.lmults[bonus];

        binfo.board[x][y] = lseq;
        binfo.boardp[x][y] = lscr;

        while (x >= 0 && y >= 0 && binfo.board[x][y] !== "") {
            x -= dy;
            y -= dx;
        }

        if (x < 0 || y < 0 || binfo.board[x][y] === "") {
            x += dy;
            y += dx;
        }

        while (x < self.bx && y < self.by && binfo.board[x][y] !== "") {
            orthword += binfo.board[x][y];
            score += binfo.boardp[x][y];
            x += dy;
            y += dx;
        }

        // Orthogonal word built - we can now go back to the previous
        // value on the board in the position of the orthogonal anchor
        binfo.board[xsave][ysave] = lsave;
        binfo.boardp[xsave][ysave] = ssave;

        if (orthword.length === 1) { // the letter does not form an orthogonal word.
            return {score: 0, word: orthword};
        }

        if (!self.validWord(orthword)) {
            return {score: -1, word: orthword};
        }

        score *= wordmult;
        return {score: score, word: orthword};
    };

    //---------------------------------------------------------------------------
    self.createWordinfoStruct = function (ax, ay, lmults, seq_lscrs, num_s, numjokers,
                                          owords, prec, ps, score, req_seq, word,
                                          wordmult, xy) {
        return {
            ax: ax,
            ay: ay,
            lmults: lmults,     // number of letter bonus squares covered
            lscrs: seq_lscrs,
            num_s: num_s,
            numjokers: numjokers,
            owords: owords,
            prec: prec,         // letters before anchor
            ps: ps,             // index of word start
            score: score,
            seq: req_seq,       // sequence to put on board
            word: word,
            wordmult: wordmult, // 2x, 3x, etc word bonus?
            xy: xy             // scan dir
        }
    };

    //---------------------------------------------------------------------------
    self.findFirstMoves = function (binfo, rack) {
        let a, i, j, k, m, idx, numjokers = 0, word, ok, word_score,
            letter_counts_arr = new Array(26).fill(0),
            local_letter_counts_arr, local_jokers,
            words_arr, res_arr = [], num_s, lscrs, lmults, wordmult,
            start_xy = self.getStartXY();

        for (i = 0, j = rack.length; i < j; i++) {
            if (rack[i] === '*')
                numjokers++;
            else {
                letter_counts_arr[rack.charCodeAt(i) - self.ASCII_a]++;
            }
        }

        for (a = self.racksize - 2; a >= 0; a--) {
            words_arr = self.g_wstr[a].split("__");

            for (i = 0, j = words_arr.length; i < j; i++) {
                if (words_arr[i].length === 0) {
                    continue;
                }
                local_letter_counts_arr = letter_counts_arr.slice(0);
                local_jokers = numjokers;
                word = words_arr[i];
                word_score = 0;
                lscrs = [];
                num_s = 0;
                ok = true;
                for (k = 0, m = word.length; k < m; k++) {
                    idx = word.charCodeAt(k) - self.ASCII_a;
                    if (local_letter_counts_arr[idx] === 0) {
                        if (local_jokers === 0) {
                            ok = false;
                            break;
                        }
                        local_jokers--;
                        lscrs.push(0);
                    } else {
                        local_letter_counts_arr[idx]--;
                        word_score += self.letscore[word[k]];
                        lscrs.push(self.letscore[word[k]]);
                        if (word[k] === "s")
                            num_s++;
                    }
                }

                if (ok) {
                    lmults = 0;
                    wordmult = 0;
                    if (self.gametype === self.gametype_wwf) {
                        if (a > 2) {
                            word_score *= 2;
                            lmults = 1;
                            wordmult = 2;
                        }
                    }

                    if (a === self.racksize - 2)
                        word_score += self.allLettersBonus;

                    // TODO change starting location depending on word length and
                    // usage of s'es and blanks
                    res_arr.push({
                        ax: start_xy.x,
                        ay: start_xy.y,
                        lmults: lmults,   // number of letter bonus squares covered
                        lscrs: lscrs,
                        num_s: num_s,
                        numjokers: numjokers - local_jokers,
                        owords: [],
                        prec: "",         // letters before anchor
                        ps: start_xy.x,   // index of word start
                        score: word_score,
                        seq: word,       // sequence to put on board
                        word: word,
                        wordmult: wordmult, // 2x, 3x, etc word bonus?
                        xy: "x"           // scan dir
                    });
                }
            }
        }

        self.moves = res_arr.sort(function (a, b) {
            return b.score - a.score || a.word.localeCompare(b.word)
        }).slice(0, 23);
    };

    //---------------------------------------------------------------------------
    self.getTopXWords = function (numWordsToGet, binfo, rack) {
        let i, j, ax, ay, regex, numjokers = 0,
            rletmap = new Array(26).fill(0),
            matches_cache = {}, found_words = [],
            rx_count = 0;

        for (i = 0, j = rack.length; i < j; i++) {
            if (rack[i] === '*')
                numjokers++;
            else {
                rletmap[rack.charCodeAt(i) - self.ASCII_a]++;
            }
        }

        for (ax = 0; ax < self.bx; ax++) {
            for (ay = 0; ay < self.by; ay++) {
                if (binfo.board[ax][ay] === "") {
                    regex = self.getRegex("x", ax, ay, binfo.board, rack, numjokers > 0);
                    // if (regex)
                    // logit(regex);
                    if (regex) {
                        rx_count++;
                        found_words = found_words.concat(
                            self.getAllWordsForRegex(binfo, regex, rletmap, numjokers, ax, ay, matches_cache));
                    }

                    regex = self.getRegex("y", ax, ay, binfo.board, rack, numjokers > 0);
                    // if (regex)
                    // logit(regex);
                    if (regex) {
                        rx_count++;
                        found_words = found_words.concat(
                            self.getAllWordsForRegex(binfo, regex, rletmap, numjokers, ax, ay, matches_cache));
                    }
                }
            }
        }

        // self.rx_count = rx_count;
        // self.word_count = found_words.length;
        // logit(self.word_count);
        // logit(self.moves);
        matches_cache = null;
        self.moves = found_words.sort(function (a, b) {
            return b.score - a.score;
        }).slice(0, numWordsToGet);
    };

    //---------------------------------------------------------------------------
    self.getAllWordsForRegex = function (binfo, regex, rletmap, numjokers, ax, ay, matches_cache) {
        let i, j, k, match, matches, req_seq, word, wlc, id,
            wordinfo, wordinfos = [], seq_lscrs = [], num_s = 0, idx = 0,
            letmap, ok, jokers, regexp = new RegExp(regex.rgx, "g");

        // TODO check regex min and max
        for (wlc = regex.min - 2; wlc < regex.max - 1; wlc++) {
            id = regex.rgx + wlc;

            if (id in matches_cache)
                matches = matches_cache[id];
            else {
                matches = [];
                while ((match = regexp.exec(self.g_wstr[wlc])) !== null) {
                    req_seq = "";
                    for (i = 1; i < match.length; i++) {
                        if (match[i])
                            req_seq += match[i];
                    }
                    word = match[0].substr(1, match[0].length - 2);
                    matches.push({word: word, reqs: req_seq});
                }
                matches_cache[id] = matches;
            }

            for (j = 0; j < matches.length; j++) {
                letmap = rletmap.slice();
                jokers = numjokers;
                seq_lscrs = [];
                req_seq = matches[j].reqs;
                num_s = 0;
                ok = true;
                for (i = 0, k = req_seq.length; i < k; i++) {
                    idx = req_seq.charCodeAt(i) - self.ASCII_a;
                    if (letmap[idx] === 0) {
                        if (jokers === 0) {
                            ok = false;
                            break;
                        }
                        jokers--;
                        seq_lscrs.push(0); // no points for joker
                    } else {
                        letmap[idx]--;
                        seq_lscrs.push(self.letscore[req_seq[i]]);
                        if (req_seq[i] === 's')
                            num_s++;
                    }
                }

                if (ok) {
                    wordinfo = {
                        word: matches[j].word,
                        lscrs: seq_lscrs,
                        ax: ax,
                        ay: ay,
                        seq: req_seq,       // sequence to put on board
                        ps: regex.ps,       // index of word start
                        prec: regex.prec,   // letters before anchor
                        xy: regex.xy,       // scan dir
                        lmults: 0,          // number of letter bonus squares covered
                        wordmult: 1         // 2x, 3x, etc word bonus?
                    };

                    wordinfo.score = self.getWordScore(binfo, wordinfo);
                    if (wordinfo.score > -1) {
                        wordinfo.numjokers = numjokers - jokers;
                        wordinfo.num_s = num_s;
                        wordinfos.push(wordinfo);
                    }
                }
            }
        }
        return wordinfos;
    };

    //---------------------------------------------------------------------------
    self.getUnique = function (str) {
        return String.prototype.concat(...new Set(str))
    };

    //---------------------------------------------------------------------------
    self.getRegex = function (dir, ax, ay, board, rack, has_joker) {
        // deX........  => /de[a-z]{1,7}/g
        // ..eX.m.....  => /e[a-z]{2}m[a-z]{0,3}/g
        // ...X.m..p..  => /e[a-z]m[a-z]{2}p[a-z]{0,2}/g
        // r = new RegExp("de[a-z]{1,7}", "g")
        let i,
            xdir = (dir === "x"),
            ap = xdir ? ax : ay,
            max = xdir ? self.bx : self.by,
            dx = xdir ? 1 : 0,
            dy = 1 - dx,
            l_x = ax - dx, // board position to left of x
            a_y = ay - dy, // board position above y
            b_y, r_x,
            sc = ap,  // sc: short for scan
            scx = ax + dx,
            scy = ay + dy,
            letrange = has_joker ? self.letrange : "[" + self.getUnique(rack) + "]",

            // by default, set the minimum location of the first
            // letter found in the parallel line search to be
            // higher than any possible minimum found when building
            // the regex, so that if no minimum is found in the
            // parallel scan, the minimum from the regex creation
            // will be used.
            sminpos = max,
            empty,
            found = (ap > 0 && board[l_x][a_y] !== "");

        if (!found)
            empty = 0;
        // No board letters to the left or above anchor, check
        // if lines parallel to direction have letters in them.
        while (sc < max - 1) {
            if (board[scx][scy] !== "") {
                found = true;
                break;
            } else
                empty++;

            if (empty > rack.length)
                break;

            a_y = scy - dx;  // x line above y
            b_y = scy + dx;  // x line below y
            l_x = scx - dy;  // y line left of x
            r_x = scx + dy;  // y line right of x
            if (l_x >= 0 && a_y >= 0 && board[l_x][a_y] !== "" ||
                r_x < max && b_y < max && board[r_x][b_y] !== "") {
                // found a board letter to the left or above the scanned line.
                sminpos = sc + 1;
                found = true;
                break;
            }

            scx += dx;
            scy += dy;
            sc++;
        }

        if (!found) {
            return null; // No letters that we can connect to from ax,ay
        }

        let ps = ap - 1,
            xs = ax - dx,
            ys = ay - dy,
            prev = "";

        // Find any letters immediately preceding the first placement location
        while (ps >= 0 && board[xs][ys] !== "") {
            xs -= dx;
            ys -= dy;
            ps--;
        }

        if (ps < 0) {
            ps = 0;
            if (xs < 0)
                xs = 0;
            else if (ys < 0)
                ys = 0;
        }

        for (i = ps; i < ap; i++) {
            prev += board[xs][ys];
            xs += dx;
            ys += dy;
        }

        // prev now contains the sequence of letters that immediately precede
        // the anchor position (either above it or to it's left, depending on
        // the direction context).
        // Generate the regular expression for the possible words
        // starting at ax,ay using direction dir. Also calculate minimum
        // word size, maximum word size and word starting position.
        let x = ax,
            y = ay,
            p = ap,
            regex = "_" + prev,
            regex2 = "", // another possible match
            letters = 0,
            blanks = 0,
            minl = 0, // minimum word length that can be created
            minplay = 1, // no letters were played yet
            countpost = false, // flag to include letters in line for minl count
            flpos = ap,
            mindiff = 0,
            s,
            maxl;

        // iterate over word letters
        while (p < max) {
            if (board[x][y] === "") {
                if (p === ap && prev.length > 0) {
                    minl = prev.length + 1;
                    countpost = true; // start adding additional board letters to minimum word length
                } else {
                    countpost = false; // stop adding additional board letters to minimum word length
                }

                blanks++;
                if (letters === rack.length)
                    break;
                letters++;
            } else {
                if (blanks > 0) {
                    regex += "(" + letrange;
                    if (blanks > 1) {
                        // If there are letters before the anchor position
                        // and two or more free spaces, we can add another
                        // match for a shorter word without connecting
                        // to additional letters in same line on board.
                        // For example, the following:
                        // ..ad..sing (two blanks after d)
                        // Should make it possible to find ..adD.sing
                        // and also ..adVIsing, so the search should match
                        // _ad([a-z]{1})_  or _ad([a-z]{2})sing_
                        if (prev !== "") {
                            regex2 = "|" + regex;
                            if (blanks > 2)
                                regex2 += "{1," + (blanks - 1) + "}";
                            regex2 += ")_";
                        }
                        regex += "{" + blanks + "}";
                    }
                    regex += ")";
                    if (minl === 0) {
                        minl = prev.length + blanks;
                        // start adding additional board
                        // letters to minimum word length
                        countpost = true;
                    }
                    if (countpost && flpos === ap) {
                        // save 1st letter position
                        flpos = p;
                    }
                    blanks = 0;
                }
                regex += board[x][y];
                if (countpost)
                    minl++;
                minplay = 0; // letters were played
            }
            x += dx;
            y += dy;
            p++;
        }

        if (blanks > 0) {
            // Last place was a blank
            regex += "(" + letrange;
            if (p === max)
            // and it was the end of the board
                regex += "{" + minplay + "," + blanks + "}";
            else {
                // used all the letters before reaching the end of the board
                // check the next board space
                if (board[x][y] === "")
                    regex += "{" + minplay + "," + blanks + "}";
                else {
                    regex += "{" + blanks + "}";
                    for (i = p + 1; i < max; i++) {
                        if (board[x][y] === "")
                            break;
                        regex += board[x][y];
                        x += dx;
                        y += dy;
                    }
                }
            }
            regex += ")";
        }

        // flpos - position of first letter that was found when generating the regex
        if (flpos === ap)
        // no first letter was found in the regex scan.
        // Are there any letters before the anchor?
            if (prev !== "")
            //  yes - then the minimum is one more
                minl = prev.length + 1;
            else
            // No, then set the minimum word length to
            // be the distance to the first letter found
            // in the parallel line scan.
                minl = sminpos - ap + 1;
        else {
            mindiff = flpos - sminpos;
            if (mindiff > 1)
            // If the regex scan first letter position is at a
            // distance of two or more further from the parallel
            // scan first letter position, then the minimum word
            // length is the distance from the anchor to the first
            // letter found in the parallel scan.
                minl -= mindiff;
        }

        s = ap - prev.length;
        maxl = p - s;
        regex += "_" + regex2;

        return {
            rgx: regex,
            ps: s,
            min: minl,
            max: maxl,
            prec: prev,
            xy: dir
        }
    };

    //---------------------------------------------------------------------------
    self.selectBestWord = function (rack) {
        let i, j, found_word, wordscore_diff,
            best_word = self.moves[0];

        // logit(self.moves);
        //add q+u rules...
        for (i = 1, j = self.moves.length; i < j; i++) {
            found_word = self.moves[i];
            wordscore_diff = best_word.score - found_word.score;

            if (best_word.numjokers - found_word.numjokers > 0 &&
                best_word.num_s - found_word.num_s > 0 &&
                wordscore_diff < 35) {
                best_word = found_word;
            } else if (best_word.numjokers - found_word.numjokers > 0 && wordscore_diff < 25) {
                best_word = found_word;
            } else if (best_word.num_s - found_word.num_s > 0 && wordscore_diff < 10) {
                best_word = found_word;
            } else if (found_word.wordmult > best_word.wordmult && wordscore_diff < 10) {
                best_word = found_word;
            } else if (found_word.lmults > best_word.lmults && wordscore_diff < 10) {
                best_word = found_word;
            }
            //check tiles left in tray - double letters...?
        }
        return best_word;
    };

    //---------------------------------------------------------------------------
    self.selectWordByMaxpoints = function (level, pscore, oscore) {
        let score_to_find = self.maxwpoints[level - 1],
            sel_word = self.moves[self.moves.length - 1],
            score_diff = pscore - oscore;

        if (level === 4) {
            score_to_find = 20;
            if (score_diff > 0) {
                score_to_find += score_diff;
            }
        }

        for (let i = self.moves.length - 2; i >= 0; i--) {
            if (self.moves[i].score < score_to_find) {
                sel_word = self.moves[i];
            }
        }
        return sel_word;
    };

    //---------------------------------------------------------------------------
    self.localStorageGoBack = function () {
        let gt = localStorage.getItem("gametype"),
            lgt = localStorage.getItem("last_gametype");

        if (gt && lgt && gt === lgt) {
            localStorage.setItem("board", localStorage.getItem("last_board"));
            localStorage.setItem("myletters", localStorage.getItem("last_myletters"));
            localStorage.setItem("completters", localStorage.getItem("last_completters"));
            localStorage.setItem("pscore", localStorage.getItem("last_pscore"));
            localStorage.setItem("oscore", localStorage.getItem("last_oscore"));
            localStorage.setItem("letpool", localStorage.getItem("last_letpool"));
            localStorage.setItem("history", localStorage.getItem("last_history"));
        }
    };

    //---------------------------------------------------------------------------
    self.updateLocalStorage = function (gametype, board, myletters, completters, pscore, oscore, history) {
        localStorage.setItem("last_gametype", localStorage.getItem("gametype"));
        localStorage.setItem("last_board", localStorage.getItem("board"));
        localStorage.setItem("last_myletters", localStorage.getItem("myletters"));
        localStorage.setItem("last_completters", localStorage.getItem("completters"));
        localStorage.setItem("last_pscore", localStorage.getItem("pscore"));
        localStorage.setItem("last_oscore", localStorage.getItem("oscore"));
        localStorage.setItem("last_letpool", localStorage.getItem("letpool"));
        localStorage.setItem("last_history", localStorage.getItem("history"));

        localStorage.setItem("gametype", gametype);
        localStorage.setItem("board", JSON.stringify(board));
        localStorage.setItem("myletters", myletters);
        localStorage.setItem("completters", completters);
        localStorage.setItem("pscore", pscore);
        localStorage.setItem("oscore", oscore);
        localStorage.setItem("letpool", JSON.stringify(self.letpool));
        localStorage.setItem("history", JSON.stringify(history));
    };

    //---------------------------------------------------------------------------
    self.clearLocalStorage = function () {
        localStorage.removeItem("gametype");
        localStorage.removeItem("board");
        localStorage.removeItem("myletters");
        localStorage.removeItem("completters");
        localStorage.removeItem("letpool");
        localStorage.removeItem("pscore");
        localStorage.removeItem("oscore");
        localStorage.removeItem("history");

        localStorage.removeItem("last_gametype");
        localStorage.removeItem("last_board");
        localStorage.removeItem("last_myletters");
        localStorage.removeItem("last_completters");
        localStorage.removeItem("last_letpool");
        localStorage.removeItem("last_pscore");
        localStorage.removeItem("last_oscore");
        localStorage.removeItem("last_history");
    };
}
