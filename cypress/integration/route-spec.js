describe('Router', function() {
    it('Should start at state A', function() {
        cy.visit('tests/test-route.html#/').then(function() {
            cy.get('#configPath').should(function(inp) {
                console.log(inp);
                expect(inp.val()).to.equal('a');
            });
        });
    });
    it('Should not allow URL to B1', function() {
        cy.visit('tests/test-route.html#/b1').then(function() {
            cy.get('#configPath').should(function(inp) {
                console.log(inp);
                expect(inp.val()).to.equal('Not Found');
            });
        });
    });
    it('Should not allow navigate to B1', function() {
        cy.visit('tests/test-route.html#/');
        cy.get('#navB1').click();
        cy.get('#configPath').should(function(inp) {
            console.log(inp);
            expect(inp.val()).to.equal('Not Found');
        });
    });

    it('Should allow URL to B1 C1', function() {
        cy.visit('tests/test-route.html#/b1/c1');
        cy.get('#configPath').should(function(inp) {
            console.log(inp);
            expect(inp.val()).to.equal('a.b1.c1');
        });
    });
    it('Should allow navigate to B1 C1', function() {
        cy.visit('tests/test-route.html#/');
        cy.get('#navB1C1').click();
        cy.get('#configPath').should(function(inp) {
            console.log(inp);
            expect(inp.val()).to.equal('a.b1.c1');
        });
    });
});
