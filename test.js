(function iife() {
    if (!Bkgdr.inWorker) {
        Bkgdr.init(true, {workerPath: "dist/bkgdr.js"});//, bootstrapWindowContext: false});
        Bkgdr.wi.addScript("../test.js")
        .then(() => {
             return Bkgdr.wi.executeWithPromise("Math.random")
        }).then(function(returnVal) {
               console.log(returnVal);
        });
        return;
    } else {
        setTimeout(() => {doStuff();}, 2000);
    }

    function doStuff() {
        Bkgdr.wi.executeWithPromise("Date.now")
            .then(function(val) {
            var returnVal = "Date.now from worker: " + val;
            console.log(returnVal);
            });
         document.createAttribute('atrsond');
         Bkgdr.wi.execute("document.body.setAttribute", ["value", "somethinglame"]);
    }

})();