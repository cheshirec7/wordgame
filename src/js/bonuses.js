function SCRBonusesLayout() {
    let self = this;
    self.boardm = [];
    self.init = function () {
        self.bx = 15;
        self.by = 15;

        let i, j;
        for (i = 0; i < self.bx; i++) {
            self.boardm[i] = [];
            for (j = 0; j < self.by; j++)
                self.boardm[i][j] = 0;
        }

        self.setquad(0, 0, 4); //TW
        self.setquad(1, 1, 3); //DW
        self.setquad(2, 2, 3); //DW
        self.setquad(3, 3, 3); //DW
        self.setquad(4, 4, 3); //DW
        self.setquad(5, 5, 2); //TL
        self.setquad(6, 6, 1); //DL
        self.setquad(3, 0, 1); //DL
        self.setquad(0, 3, 1); //DL
        self.setquad(0, 7, 4); //TW
        self.setquad(1, 5, 2); //TL
        self.setquad(2, 6, 1); //DL
        self.setquad(3, 7, 1); //DL
        self.setquad(7, 0, 4); //TW
        self.setquad(5, 1, 2); //TL
        self.setquad(6, 2, 1); //DL
        self.setquad(7, 3, 1); //DL

        return self.boardm;
    };

    self.setquad = function (x, y, s) {
        let x1 = x,
            y1 = y,
            x2 = self.bx - x - 1,
            y2 = self.by - y - 1;
        self.boardm[x1][y1] = s;
        self.boardm[x1][y2] = s;
        self.boardm[x2][y1] = s;
        self.boardm[x2][y2] = s;
    };
}

function WWFBonusesLayout() {
    let self = this;
    self.boardm = [];
    self.init = function () {
        self.bx = 15;
        self.by = 15;

        let i, j;

        for (i = 0; i < self.bx; i++) {
            self.boardm[i] = [];
            for (j = 0; j < self.by; j++)
                self.boardm[i][j] = 0;
        }

        self.setquad(3, 0, 4); //TW
        self.setquad(0, 3, 4); //TW
        self.setquad(2, 1, 1); //DL
        self.setquad(1, 2, 1); //DL
        self.setquad(0, 6, 2); //TL
        self.setquad(6, 0, 2); //TL
        self.setquad(1, 5, 3); //DW
        self.setquad(5, 1, 3); //DW
        self.setquad(2, 4, 1); //DL
        self.setquad(4, 2, 1); //DL
        self.setquad(3, 3, 2); //TL
        self.setquad(3, 7, 3); //DW
        self.setquad(7, 3, 3); //DW
        self.setquad(4, 6, 1); //DL
        self.setquad(6, 4, 1); //DL
        self.setquad(5, 5, 2); //TL

        return self.boardm;
    };

    self.setquad = function (x, y, s) {
        let x1 = x,
            y1 = y,
            x2 = self.bx - x - 1,
            y2 = self.by - y - 1;
        self.boardm[x1][y1] = s;
        self.boardm[x1][y2] = s;
        self.boardm[x2][y1] = s;
        self.boardm[x2][y2] = s;
    };
}
