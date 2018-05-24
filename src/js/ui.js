"use strict";

//---------------------------------------------------------------------------
function logit(str) {
    window.console && console.log(str);
}

//---------------------------------------------------------------------------
$(document).ready(function ($) {
    const g_human = 1,
        g_computer = 2,
        g_maxpasses = 2,                        // maximum number of consecutive passes
        g_plrRackId = "pl",
        g_oppRackId = "op",
        g_boardId = "c";

    let g_passes = 0,                           // number of consecutive passes
        g_pscore = 0,                           // player score
        g_oscore = 0,                           // opponent (computer) score
        g_myletters = "",
        g_completters = "",
        g_history = "",
        g_blankDivToReplace,
        engine = null,
        gameover = false,
        initializing = true,

        $loader = $(".loader"),
        $level = $("#selDifficulty"),
        $msg = $("#msg"),
        $history = $("#history"),
        $playerScore = $("#pscore"),
        $computerScore = $("#oscore"),
        $tilesLeft = $("#tleft"),
        $board = $("#board"),
        $lettersModal = $("#lettersModal"),
        $swapModal = $("#swapModal"),
        $suggestModal = $("#suggestModal"),
        $bodySuggest = $("#bodySuggest"),

        //---------------------------------------------------------------------------
        $gametype = $("#selGameType").change(function () {
            newGame();
        }),
        btnNewGame = $("#btnNew").click(function () {
            newGame();
        }),

        //---------------------------------------------------------------------------
        btnPass = $("#btnPass").click(function () {
            if (initializing || gameover)
                return;
            swal({
                title: "Pass your move?",
                text: "",
                type: "warning",
                showCancelButton: true,
                confirmButtonText: "Pass",
                cancelButtonText: "Cancel",
                confirmButtonClass: "btn btn-success",
                cancelButtonClass: "btn btn-danger",
                buttonsStyling: false,
                reverseButtons: true
            }).then((result) => {
                if (result.value) {
                    updateUI(JSON.parse(localStorage.getItem("board")));
                    g_history += "<div>You: Passed</div>";
                    g_passes++;
                    if (g_passes >= g_maxpasses) {
                        announceWinner();
                        return;
                    }
                    doComputerMove();
                }
            })
        }),

        //---------------------------------------------------------------------------
        btnRecall = $("#btnRecall").click(function () {
            if (initializing || gameover)
                return;
            updateUI(JSON.parse(localStorage.getItem("board")));
        }),

        //---------------------------------------------------------------------------
        btnGoBack = $("#btnGoBack").click(function () {
            if (initializing || gameover)
                return;
            engine.localStorageGoBack();
            location.reload();
        }),

        //---------------------------------------------------------------------------
        btnSuggest = $("#btnSuggest").click(function () {
            if (initializing || gameover)
                return;
            $msg.html("");
            $loader.show();

            setTimeout(function () {

                let binfo = getBoardPointsPlacementsArrays(true),
                    i, j, body = "", dir, position;

                if (binfo.board_empty) {
                    engine.findFirstMoves(binfo, g_myletters);
                } else {
                    engine.getTopXWords(23, binfo, g_myletters);
                }

                if (engine.moves.length === 0) {
                    body = "<tr><td colspan='3'>No suggestions found.</td></tr>"
                } else {
                    for (i = 0, j = engine.moves.length; i < j; i++) {
                        position = String.fromCharCode(engine.ASCII_A + engine.moves[i].ax) + (engine.moves[i].ay + 1);
                        dir = (engine.moves[i].xy === "y") ? "&#9660;" : "&#9658;";
                        body += "<tr>";
                        body += "<td>" + engine.moves[i].word + "</td>";
                        body += "<td>" + engine.moves[i].score + "</td>";
                        body += "<td>" + position + " " + dir + "</td>";
                        body += "</tr>";
                    }
                }

                binfo = null;
                engine.moves = null;
                $bodySuggest.html(body);
                $suggestModal.modal().draggable();
                $loader.hide();
            }, 50);
        }),

        //---------------------------------------------------------------------------
        btnShuffle = $("#btnShuffle").click(function () {
            if (initializing || gameover)
                return;
            let a = g_myletters.split(""),
                n = a.length,
                i, j, tmp;

            updateUI(JSON.parse(localStorage.getItem("board")));

            for (i = n - 1; i > 0; i--) {
                j = Math.floor(Math.random() * (i + 1));
                tmp = a[i];
                a[i] = a[j];
                a[j] = tmp;
            }
            g_myletters = a.join("");
            localStorage.setItem("myletters", g_myletters);
            updateRack(g_human);
            initRedips();
        }),

        //---------------------------------------------------------------------------
        btnSwap = $("#btnSwap").click(function () {
            if (initializing || gameover)
                return;
            let i, $swap_cell, ltr, html;

            updateUI(JSON.parse(localStorage.getItem("board")));
            if (engine.letpool.length === 0) {
                swal("No letters left to swap");
                return;
            }

            for (i = 0; i < engine.racksize; i++) {
                $swap_cell = $("#swap" + i).html("");
                $("#chkSwap" + i).prop("checked", false);
                ltr = i < g_myletters.length ? g_myletters[i] : "";
                if (ltr !== "") {
                    html = "<div class='redips-drag t1'>";
                    if (ltr !== "*") {
                        html += g_myletters[i].toUpperCase() + "<sup>" + engine.letscore[ltr] + "</sup>";
                    }
                    html += "</div>";
                    $swap_cell.html(html);
                }
            }

            $swapModal.modal();
        }),

        //---------------------------------------------------------------------------
        btnSwapAccept = $("#btnSwapOK").click(function () {
            if (initializing || gameover)
                return;
            let i, swapletters = "", mynewrack = "", sw_len;

            for (i = 0; i < g_myletters.length; i++) {
                if ($("#chkSwap" + i).is(":checked")) {
                    swapletters += g_myletters[i];
                } else {
                    mynewrack += g_myletters[i];
                }
            }

            if (swapletters.length === 0)
                return;

            if (swapletters.length > engine.letpool.length) {
                swal("You can only swap " + engine.letpool.length + " letters");
                return;
            }

            g_myletters = engine.takeLetters(mynewrack);

            sw_len = swapletters.length;
            for (i = 0; i < sw_len; i++) {
                engine.letpool.push(swapletters[i]);
            }
            engine.shufflePool();
            g_history += "<div>You: Swapped " + swapletters.toUpperCase() + "</div>";
            $swapModal.modal("hide");
            doComputerMove();
        }),

        //---------------------------------------------------------------------------
        btnHumanPlay = $("#btnPlay").click(function () {
            if (initializing || gameover)
                return;
            let binfo = getBoardPointsPlacementsArrays(),
                pinfo = engine.checkValidPlacement(binfo);

            if (pinfo.msg !== "") {
                $msg.html(pinfo.msg).css("color", "#f86c6b");
                return;
            }

            g_passes = 0;
            $("td", $board).removeClass("lastplayed");
            commitHumanMove(binfo.placement);
            g_pscore += parseInt(pinfo.score);
            g_myletters = engine.takeLetters(g_myletters);
            g_history += "<div>You: " + pinfo.words.join(", ").toUpperCase() + " (" + pinfo.score + " pts)</div>";

            binfo = null;
            pinfo = null;

            updateUI("");
            if (g_myletters === "") {
                announceWinner();
                return;
            }
            doComputerMove();
        }),

        //---------------------------------------------------------------------------
        btnChooseLetterForBlank = $(".btn", $lettersModal).click(function () {
            let letter = $(this).html();
            $(g_blankDivToReplace)
                .attr("data-letter", letter.toLowerCase())
                .html(letter);
            updateMsgIfValidPlacement();
            $lettersModal.modal("hide");
        });

    //---------------------------------------------------------------------------
    function newGame() {
        swal({
            title: "Start a new game?",
            text: "You will lose all progress made in the current game.",
            type: "warning",
            showCancelButton: true,
            confirmButtonText: "Start New Game",
            cancelButtonText: "Cancel",
            confirmButtonClass: "btn btn-success",
            cancelButtonClass: "btn btn-danger",
            buttonsStyling: false,
            reverseButtons: true
        }).then((result) => {
            if (result.value) {
                engine.clearLocalStorage();
                localStorage.setItem("newgame", $gametype.val());
                location.reload();
            }
        })
    }

    //---------------------------------------------------------------------------
    function announceWinner() {
        let i, html;

        gameover = true;
        for (i = 0; i < g_myletters.length; i++)
            g_pscore -= engine.letscore[g_myletters[i]];

        for (i = 0; i < g_completters.length; i++)
            g_oscore -= engine.letscore[g_completters[i]];

        html = "Final Score<br><br>";
        html += "You: " + g_pscore + "&nbsp;&nbsp;&nbsp;AI: " + g_oscore + "<br><br>";
        if (g_oscore > g_pscore)
            html += "Computer Wins";
        else if (g_oscore < g_pscore)
            html += "You win!";
        else
            html += "It's a draw!";

        engine.clearLocalStorage();
        updateUI();
        swal(html);
        $msg.html("Game Over").css("color", "#f86c6b");
    }

    //---------------------------------------------------------------------------
    function doComputerMove() {
        $loader.show();

        setTimeout(function () {
            let found_word,
                level = parseInt($level.val()),
                binfo = getBoardPointsPlacementsArrays();

            if (binfo.board_empty) {
                engine.findFirstMoves(binfo, g_completters);
            } else {
                if (level < 5) {
                    engine.getTopXWords(100, binfo, g_completters);
                } else {
                    engine.getTopXWords(23, binfo, g_completters);
                }
            }

            // TODO check if swap makes sense

            if (engine.moves.length === 0) {
                g_passes++;
                if (g_passes >= g_maxpasses) {
                    $loader.hide();
                    engine.moves = null;
                    announceWinner();
                    return;
                }
            }

            if (level < 5) {
                found_word = engine.selectWordByMaxpoints(level, g_pscore, g_oscore);
            } else {
                found_word = engine.selectBestWord(g_completters);
            }

            engine.moves = null;
            // TODO swap if score less than 20?

            g_passes = 0;
            $("td", $board).removeClass("lastplayed");
            commitComputerMove(binfo, found_word);
            g_oscore += parseInt(found_word.score);
            g_completters = engine.takeLetters(g_completters);
            let words = found_word.word.toUpperCase();
            if (found_word.owords.length > 0)
                words += ", " + found_word.owords.join(", ").toUpperCase();
            g_history += "<div class='ai'>AI: " + words + " (" + found_word.score + " pts)</div>";
            updateLocalStorage();
            updateUI("");
            $loader.hide();
            if (g_completters === "") {
                announceWinner();
            }
            $msg.html("AI played " + words + " for " + found_word.score + " points").css("color", "#3cf");
            found_word = null;
            binfo = null;
        }, 50);
    }

    //---------------------------------------------------------------------------
    function commitComputerMove(binfo, found_word) {
        let xdir = (found_word.xy === "x"),
            max = xdir ? engine.bx : engine.by,
            dx = xdir ? 1 : 0,
            dy = 1 - dx,
            ps = found_word.ps,
            x, y, lseq, lscr, seqc = 0, sup;

        if (xdir) {
            x = ps;
            y = found_word.ay;
        } else {
            x = found_word.ax;
            y = ps;
        }

        while (ps < max) {
            if (binfo.board[x][y] === "" && seqc < found_word.seq.length) {
                lscr = found_word.lscrs[seqc];
                lseq = found_word.seq[seqc];
                if (lscr > 0) {
                    sup = "<sup>" + lscr + "</sup>";
                    g_completters = g_completters.replace(lseq, "");
                } else {
                    sup = "";
                    g_completters = g_completters.replace("*", "");
                }

                $("#" + g_boardId + x + "_" + y)
                    .attr("data-letter", lseq)
                    .attr("data-points", lscr)
                    .html(lseq.toUpperCase() + sup)
                    .addClass("redips-mark lastplayed");
                seqc++;
            } else if (binfo.board[x][y] === "" && seqc === found_word.seq.length) {
                break;
            }
            x += dx;
            y += dy;
            ps++;
        }
    }

    //---------------------------------------------------------------------------
    function commitHumanMove(cells) {
        let sup;
        $.each(cells, function (index, cell) {
            if (cell.lsc > 0) {
                sup = "<sup>" + cell.lsc + "</sup>";
                g_myletters = g_myletters.replace(cell.ltr, "");
            } else {
                sup = "";
                g_myletters = g_myletters.replace("*", "");
            }
            $("#" + g_boardId + cell.x + "_" + cell.y)
                .attr("data-letter", cell.ltr)
                .attr("data-points", cell.lsc)
                .html(cell.ltr.toUpperCase() + sup)
                .addClass("redips-mark lastplayed");
        });
    }

    //---------------------------------------------------------------------------
    function updateRack(player) {
        let i, $rack_cell, ltr, html,
            rack_prefix = (player === g_human) ? g_plrRackId : g_oppRackId,
            letters = (player === g_human) ? g_myletters : g_completters;

        for (i = 0; i < engine.racksize; i++) {
            $rack_cell = $("#" + rack_prefix + i).html("");
            ltr = i < letters.length ? letters[i] : "";
            if (ltr !== "") {
                html = "<div data-letter='" + ltr + "' data-points='" + engine.letscore[ltr] + "' class='redips-drag t" + player + "'>";
                if (ltr !== "*") {
                    html += letters[i].toUpperCase() + "<sup>" + engine.letscore[ltr] + "</sup>";
                }
                html += "</div>";
                $rack_cell.html(html);
            }
        }
    }

    //---------------------------------------------------------------------------
    function getBoardPointsPlacementsArrays(lockedOnly = false) {
        let board_empty = true, x, y, $cell, letter,
            board = [], boardp = [], placement = [];
        // boardr = new Array(engine.by).fill(0),
        // boardc = new Array(engine.bx).fill(0);
        for (x = 0; x < engine.bx; x++) {
            board[x] = [];
            boardp[x] = [];
            for (y = 0; y < engine.by; y++) {
                $cell = $("#" + g_boardId + x + "_" + y);
                letter = $($cell[0]).attr("data-letter");
                if (letter) {
                    board[x][y] = letter;
                    boardp[x][y] = parseInt($($cell[0]).attr("data-points"));
                    // boardr[x]++;
                    // boardc[y]++;
                    board_empty = false;
                } else if ($cell[0].firstChild && !lockedOnly) {
                    board[x][y] = $($cell[0].firstChild).attr("data-letter");
                    boardp[x][y] = parseInt($($cell[0].firstChild).attr("data-points"));
                    // boardr[x]++;
                    // boardc[y]++;
                    placement.push({
                        ltr: board[x][y],
                        lsc: boardp[x][y],
                        x: x, y: y
                    })
                } else {
                    board[x][y] = "";
                    boardp[x][y] = 0;
                }
            }
        }
        return {
            board_empty: board_empty, placement: placement,
            board: board, boardp: boardp
            // , boardr: boardr, boardc: boardc
        };
    }

    //---------------------------------------------------------------------------
    function updateMsgIfValidPlacement() {
        let binfo = getBoardPointsPlacementsArrays(),
            pinfo = engine.checkValidPlacement(binfo);
        if (pinfo.msg === "") {
            $msg.html(pinfo.words.join(", ").toUpperCase() + " (" + pinfo.score + " pts)").css("color", "#90ee90");
        } else {
            $msg.html("");
        }
        binfo = null;
        pinfo = null;
    }

    //---------------------------------------------------------------------------
    function initRedips() {
        REDIPS.drag.init();
        REDIPS.drag.dropMode = "single";

        REDIPS.drag.event.dropped = function () {
            if (REDIPS.drag.td.target.id[0] === g_boardId) {
                let points = parseInt($(REDIPS.drag.td.current.firstChild).attr("data-points"));
                if (points === 0) {
                    g_blankDivToReplace = REDIPS.drag.td.current.firstChild;
                    $lettersModal.modal();
                } else {
                    updateMsgIfValidPlacement();
                }
            } else
                updateMsgIfValidPlacement();
        };

        REDIPS.drag.event.moved = function () {
            let points = parseInt($(REDIPS.drag.td.current.firstChild).attr("data-points"));
            if (points === 0) {
                $(REDIPS.drag.td.current.firstChild).attr("data-letter", "*");
                $(REDIPS.drag.td.current.firstChild).html("");
            }
        };

        REDIPS.drag.event.dblClicked = function () {
            if (REDIPS.drag.td.current.id[0] === g_boardId) {
                let points = parseInt($(REDIPS.drag.td.current.firstChild).attr("data-points"));
                if (points === 0) {
                    g_blankDivToReplace = REDIPS.drag.td.current.firstChild;
                    $lettersModal.modal();
                }
            }
        }
    }

    //---------------------------------------------------------------------------
    function updateLocalStorage() {
        engine.updateLocalStorage(
            $gametype.val(),
            $board.prop("outerHTML"),
            g_myletters, g_completters,
            g_pscore, g_oscore, g_history
        );
    }

    //---------------------------------------------------------------------------
    function updateUI(boardhtml) {
        updateRack(g_human);
        updateRack(g_computer);
        if (boardhtml)
            $board.html(boardhtml);
        initRedips();
        $tilesLeft.html(engine.letpool.length);
        $playerScore.html(g_pscore);
        $computerScore.html(g_oscore);
        $history.html(g_history);
        $msg.html("");
    }

    //---------------------------------------------------------------------------
    function showWords() {
        let i, j, l, k, words_arr, str = "";
        for (i = 0, j = engine.g_wstr.length; i < j; i++) {
            words_arr = engine.g_wstr[i].split("__");
            for (k = 0, l = words_arr.length; k < l; k++) {
                if (words_arr[k].length > 0)
                    str += words_arr[k] + "\n";
            }
        }
        logit(str);
    }

    //---------------------------------------------------------------------------
    function initUI() {
        let gt = localStorage.getItem("gametype");

        if (gt) {
            engine = new Engine().init(gt);
            $gametype.val(gt);
            g_myletters = localStorage.getItem("myletters");
            g_completters = localStorage.getItem("completters");
            g_pscore = parseInt(localStorage.getItem("pscore"));
            g_oscore = parseInt(localStorage.getItem("oscore"));
            g_history = JSON.parse(localStorage.getItem("history"));
            engine.letpool = JSON.parse(localStorage.getItem("letpool"));
            updateUI(JSON.parse(localStorage.getItem("board")));
            gameover = (g_myletters === "" || g_completters === "");
        } else {
            gt = localStorage.getItem("newgame");
            if (gt)
                $gametype.val(gt);
            else
                gt = $gametype.val();

            engine = new Engine().init(gt);
            g_pscore = 0;
            g_oscore = 0;
            g_history = "";
            g_myletters = engine.takeLetters("");
            g_completters = engine.takeLetters("");
            updateUI(engine.buildBoardHTML());
            updateLocalStorage();
            localStorage.removeItem("newgame");
            gameover = false;
        }
    }

    //---------------------------------------------------------------------------
    function loadWords() {
        engine.g_wstr = JSON.parse(localStorage.getItem("g_wstr"));
        if (engine.g_wstr) {
            $loader.hide();
            initializing = false;
            return;
        }

        $.get("js/lang/wordlist.json", function (words) {
            localStorage.setItem("g_wstr", JSON.stringify(words));
            engine.g_wstr = words;
            $loader.hide();
            initializing = false;
        });
    }

    //---------------------------------------------------------------------------
    function createDict(words) {
        let i, j, arr = [], arr2 = [], lastlen = 0;

        for (i = 0, j = words.length; i < j; i++) {
            if (lastlen !== words[i].length) {
                if (arr2.length > 0)
                    arr.push(arr2);
                arr2 = [];
                lastlen = words[i].length;
            }
            arr2.push(words[i]);
        }
        engine.g_words = arr;
        logit(engine.g_words);
    }

    //---------------------------------------------------------------------------
    function createDict2(words) {
        let i, j, str = "", lastlen = 0, arr = [];

        for (i = 0, j = words.length; i < j; i++) {
            if (lastlen !== words[i].length) {
                if (str.length > 0)
                    arr.push('_' + str + '_');
                str = "";
                lastlen = words[i].length;
            }
            str += '_' + (words[i]) + '_';
        }
        engine.g_wstr = arr;
        localStorage.setItem("g_wstr", JSON.stringify(arr));
    }

    //---------------------------------------------------------------------------
    function loadWords2() {
        engine.g_wstr = JSON.parse(localStorage.getItem("g_wstr"));
        if (engine.g_wstr) {
            $loader.hide();
            initializing = false;
            return;
        }

        $.get("js/lang/wordlist.txt", function (words) {
            createDict2(words.split('*'));
            $loader.hide();
            initializing = false;
        });
    }

    //---------------------------------------------------------------------------
    function loadTrie() {
        $.ajax({
            url: "js/lang/trie.json",
            dataType: "json",
            success: function (data) {
                try {
                    let trie = new FrozenTrie(data.trie, data.directory, data.nodeCount);
                    let words = [], allwords = [], i, j;

                    for (i = 97; i < 123; i++) {
                        words = trie.getPossibilities(String.fromCharCode(i), 50000);
                        for (j = 0; j < words.length; j++) {
                            words[j] = words[j].trim();
                            if (words[j].length < 16)
                                allwords.push(words[j]);
                        }
                    }

                    allwords.sort(function (a, b) {
                        return a.length - b.length || a.localeCompare(b);
                    });

                    let wordsArr = [], str = "", lastlen = 0, str2 = "";
                    for (i = 0, j = allwords.length; i < j; i++) {
                        str2 += allwords[i] + '*';
                        continue;
                        // str2 += allwords[i]+"__";
                        if (lastlen !== allwords[i].length) {
                            if (str)
                                wordsArr.push("_" + str + "_");

                            str = "";
                            lastlen = allwords[i].length;
                        }
                        str += "_" + allwords[i] + "_";
                    }

                    // localStorage.setItem("g_wstr", JSON.stringify(wordsArr));
                    // console.log(wordsArr);
                    console.log(str2);
                    $loader.hide();
                    // initUI(wordsArr);
                } catch (a) {
                    console.log('cannot create trie ' + a);
                }
            }, error: function (a, b, c) {
                console.log(b + ' ' + c);
            }
        });
    }

    $loader.show();
    setTimeout(function () {
        initUI();
        loadWords2();

        // logit(engine.g_words);
        // engine.getSuggestions(getBoardPointsPlacementsArrays(), g_completters);
        // $loader.hide();

        // showWords();
        // loadTrie();
        // $loader.show();
    }, 50);
});
