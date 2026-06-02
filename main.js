(function(){

    "use strict";

    window.HTYQ_DIAG = {};

    async function runDiag(){

        const report = {};

        try{

            if(
                typeof SillyTavern === "undefined"
            ){
                console.error(
                    "未发现 SillyTavern"
                );
                return;
            }

            const ctx =
                SillyTavern.getContext();

            report.contextKeys =
                Object.keys(ctx).sort();

            report.hasEventSource =
                !!ctx.eventSource;

            report.hasSetExtensionPrompt =
                typeof ctx.setExtensionPrompt ===
                "function";

            report.hasChat =
                Array.isArray(ctx.chat);

            report.hasCharacters =
                !!ctx.characters;

            report.hasGroups =
                !!ctx.groups;

            report.hasWorldNames =
                !!ctx.world_names;

            report.hasSaveSettings =
                typeof ctx.saveSettings ===
                "function";

            console.table(report);

            window.HTYQ_DIAG.report =
                report;

        }
        catch(err){

            console.error(err);

        }

    }

    window.HTYQ_DIAG.run =
        runDiag;

})();
