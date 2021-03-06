var app = angular.module('reportingApp', []);

//<editor-fold desc="global helpers">

var isValueAnArray = function (val) {
    return Array.isArray(val);
};

var getSpec = function (str) {
    var describes = str.split('|');
    return describes[describes.length - 1];
};
var checkIfShouldDisplaySpecName = function (prevItem, item) {
    if (!prevItem) {
        item.displaySpecName = true;
    } else if (getSpec(item.description) !== getSpec(prevItem.description)) {
        item.displaySpecName = true;
    }
};

var getParent = function (str) {
    var arr = str.split('|');
    str = "";
    for (var i = arr.length - 2; i > 0; i--) {
        str += arr[i] + " > ";
    }
    return str.slice(0, -3);
};

var getShortDescription = function (str) {
    return str.split('|')[0];
};

var countLogMessages = function (item) {
    if ((!item.logWarnings || !item.logErrors) && item.browserLogs && item.browserLogs.length > 0) {
        item.logWarnings = 0;
        item.logErrors = 0;
        for (var logNumber = 0; logNumber < item.browserLogs.length; logNumber++) {
            var logEntry = item.browserLogs[logNumber];
            if (logEntry.level === 'SEVERE') {
                item.logErrors++;
            }
            if (logEntry.level === 'WARNING') {
                item.logWarnings++;
            }
        }
    }
};

var convertTimestamp = function (timestamp) {
    var d = new Date(timestamp),
        yyyy = d.getFullYear(),
        mm = ('0' + (d.getMonth() + 1)).slice(-2),
        dd = ('0' + d.getDate()).slice(-2),
        hh = d.getHours(),
        h = hh,
        min = ('0' + d.getMinutes()).slice(-2),
        ampm = 'AM',
        time;

    if (hh > 12) {
        h = hh - 12;
        ampm = 'PM';
    } else if (hh === 12) {
        h = 12;
        ampm = 'PM';
    } else if (hh === 0) {
        h = 12;
    }

    // ie: 2013-02-18, 8:35 AM
    time = yyyy + '-' + mm + '-' + dd + ', ' + h + ':' + min + ' ' + ampm;

    return time;
};

var defaultSortFunction = function sortFunction(a, b) {
    if (a.sessionId < b.sessionId) {
        return -1;
    } else if (a.sessionId > b.sessionId) {
        return 1;
    }

    if (a.timestamp < b.timestamp) {
        return -1;
    } else if (a.timestamp > b.timestamp) {
        return 1;
    }

    return 0;
};

//</editor-fold>

app.controller('ScreenshotReportController', ['$scope', '$http', 'TitleService', function ($scope, $http, titleService) {
    var that = this;
    var clientDefaults = {};

    $scope.searchSettings = Object.assign({
        description: '',
        allselected: true,
        passed: true,
        failed: true,
        pending: true,
        withLog: true
    }, clientDefaults.searchSettings || {}); // enable customisation of search settings on first page hit

    this.warningTime = 1400;
    this.dangerTime = 1900;
    this.totalDurationFormat = clientDefaults.totalDurationFormat;
    this.showTotalDurationIn = clientDefaults.showTotalDurationIn;

    var initialColumnSettings = clientDefaults.columnSettings; // enable customisation of visible columns on first page hit
    if (initialColumnSettings) {
        if (initialColumnSettings.displayTime !== undefined) {
            // initial settings have be inverted because the html bindings are inverted (e.g. !ctrl.displayTime)
            this.displayTime = !initialColumnSettings.displayTime;
        }
        if (initialColumnSettings.displayBrowser !== undefined) {
            this.displayBrowser = !initialColumnSettings.displayBrowser; // same as above
        }
        if (initialColumnSettings.displaySessionId !== undefined) {
            this.displaySessionId = !initialColumnSettings.displaySessionId; // same as above
        }
        if (initialColumnSettings.displayOS !== undefined) {
            this.displayOS = !initialColumnSettings.displayOS; // same as above
        }
        if (initialColumnSettings.inlineScreenshots !== undefined) {
            this.inlineScreenshots = initialColumnSettings.inlineScreenshots; // this setting does not have to be inverted
        } else {
            this.inlineScreenshots = false;
        }
        if (initialColumnSettings.warningTime) {
            this.warningTime = initialColumnSettings.warningTime;
        }
        if (initialColumnSettings.dangerTime) {
            this.dangerTime = initialColumnSettings.dangerTime;
        }
    }


    this.chooseAllTypes = function () {
        var value = true;
        $scope.searchSettings.allselected = !$scope.searchSettings.allselected;
        if (!$scope.searchSettings.allselected) {
            value = false;
        }

        $scope.searchSettings.passed = value;
        $scope.searchSettings.failed = value;
        $scope.searchSettings.pending = value;
        $scope.searchSettings.withLog = value;
    };

    this.isValueAnArray = function (val) {
        return isValueAnArray(val);
    };

    this.getParent = function (str) {
        return getParent(str);
    };

    this.getSpec = function (str) {
        return getSpec(str);
    };

    this.getShortDescription = function (str) {
        return getShortDescription(str);
    };
    this.hasNextScreenshot = function (index) {
        var old = index;
        return old !== this.getNextScreenshotIdx(index);
    };

    this.hasPreviousScreenshot = function (index) {
        var old = index;
        return old !== this.getPreviousScreenshotIdx(index);
    };
    this.getNextScreenshotIdx = function (index) {
        var next = index;
        var hit = false;
        while (next + 2 < this.results.length) {
            next++;
            if (this.results[next].screenShotFile && !this.results[next].pending) {
                hit = true;
                break;
            }
        }
        return hit ? next : index;
    };

    this.getPreviousScreenshotIdx = function (index) {
        var prev = index;
        var hit = false;
        while (prev > 0) {
            prev--;
            if (this.results[prev].screenShotFile && !this.results[prev].pending) {
                hit = true;
                break;
            }
        }
        return hit ? prev : index;
    };

    this.convertTimestamp = convertTimestamp;


    this.round = function (number, roundVal) {
        return (parseFloat(number) / 1000).toFixed(roundVal);
    };


    this.passCount = function () {
        var passCount = 0;
        for (var i in this.results) {
            var result = this.results[i];
            if (result.passed) {
                passCount++;
            }
        }
        return passCount;
    };


    this.pendingCount = function () {
        var pendingCount = 0;
        for (var i in this.results) {
            var result = this.results[i];
            if (result.pending) {
                pendingCount++;
            }
        }
        return pendingCount;
    };

    this.failCount = function () {
        var failCount = 0;
        for (var i in this.results) {
            var result = this.results[i];
            if (!result.passed && !result.pending) {
                failCount++;
            }
        }
        return failCount;
    };

    this.totalDuration = function () {
        var sum = 0;
        for (var i in this.results) {
            var result = this.results[i];
            if (result.duration) {
                sum += result.duration;
            }
        }
        return sum;
    };

    this.passPerc = function () {
        return (this.passCount() / this.totalCount()) * 100;
    };
    this.pendingPerc = function () {
        return (this.pendingCount() / this.totalCount()) * 100;
    };
    this.failPerc = function () {
        return (this.failCount() / this.totalCount()) * 100;
    };
    this.totalCount = function () {
        return this.passCount() + this.failCount() + this.pendingCount();
    };


    var results = [
    {
        "description": "should display welcome message|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 18096,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00d10061-00a4-0050-000b-00ab005c0010.png",
        "timestamp": 1615674489709,
        "duration": 3086
    },
    {
        "description": "Deber??a crear un prestamo|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 18096,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "008e005c-0046-00a2-00de-009800360073.png",
        "timestamp": 1615674493590,
        "duration": 1026
    },
    {
        "description": "should display welcome message|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 15608,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00250023-0046-001f-0092-004900820016.png",
        "timestamp": 1615679609889,
        "duration": 3246
    },
    {
        "description": "Deber??a mostrar mensajes de requerido|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 15608,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1615679615043,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1615679615043,
                "type": ""
            }
        ],
        "screenShotFile": "00d100ba-00bb-00a5-0048-00ab00e400da.png",
        "timestamp": 1615679614106,
        "duration": 981
    },
    {
        "description": "should display welcome message|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 22896,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "007200d1-0001-00d5-000b-00df004e0039.png",
        "timestamp": 1615679896447,
        "duration": 3080
    },
    {
        "description": "Deber??a mostrar mensajes de requerido|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 22896,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00d60092-0056-009f-00e3-002a005800c0.png",
        "timestamp": 1615679900054,
        "duration": 198
    },
    {
        "description": "should display welcome message|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 12612,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "002b002c-004e-00ed-00d6-00d800640083.png",
        "timestamp": 1615679943550,
        "duration": 3050
    },
    {
        "description": "Deber??a mostrar mensajes de requerido|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 12612,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00c70056-00da-00c0-0040-00fd00c70059.png",
        "timestamp": 1615679947276,
        "duration": 175
    },
    {
        "description": "should display welcome message|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 22660,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "004100f6-0087-009b-008f-00bf0014001f.png",
        "timestamp": 1615680017436,
        "duration": 3228
    },
    {
        "description": "Deber??a mostrar mensajes de requerido|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 22660,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00420029-00df-003e-006c-003c0083005d.png",
        "timestamp": 1615680021198,
        "duration": 153
    },
    {
        "description": "should display welcome message|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 11796,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00ac006f-00a0-00e7-0089-004600e800ed.png",
        "timestamp": 1615680074545,
        "duration": 3030
    },
    {
        "description": "Deber??a mostrar mensajes de requerido|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 11796,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00130058-0011-006e-0008-008400ae003f.png",
        "timestamp": 1615680078237,
        "duration": 143
    },
    {
        "description": "should display welcome message|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 16284,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "002200db-00d7-001e-006a-005f00580019.png",
        "timestamp": 1615680172623,
        "duration": 3279
    },
    {
        "description": "Deber??a mostrar mensajes de requerido|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 16284,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00ea0075-0057-00a5-000a-00ec008000eb.png",
        "timestamp": 1615680176544,
        "duration": 142
    },
    {
        "description": "should display welcome message|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 14464,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "000d00a8-0083-00a3-0053-0058005400f3.png",
        "timestamp": 1615680301739,
        "duration": 3189
    },
    {
        "description": "Deber??a mostrar mensajes de requerido|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 14464,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "007500ac-008a-001f-006a-003f00980096.png",
        "timestamp": 1615680305528,
        "duration": 197
    },
    {
        "description": "should display welcome message|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 19084,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00e600cb-00ac-004b-00dd-00a9005b00c9.png",
        "timestamp": 1615813945525,
        "duration": 2973
    },
    {
        "description": "Deber??a mostrar mensajes de requerido|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 19084,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00de00b6-0029-0090-0036-00a900a000af.png",
        "timestamp": 1615813949328,
        "duration": 157
    },
    {
        "description": "should display welcome message|workspace-project App",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 16332,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Expected 'Login' to equal 'Bienvenido a Bibliotecario'."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\app.e2e-spec.ts:13:33)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7"
        ],
        "browserLogs": [],
        "screenShotFile": "009d0012-00d4-000d-007b-00e5000200cc.png",
        "timestamp": 1615915554349,
        "duration": 2978
    },
    {
        "description": "Deber??a mostrar mensajes de requerido|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 16332,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00ee0072-0027-00c3-0089-002b004d0070.png",
        "timestamp": 1615915557833,
        "duration": 161
    },
    {
        "description": "deber??a mostrar p??gina de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 1568,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00f400ae-0062-00e0-0067-00e200a30076.png",
        "timestamp": 1615919136711,
        "duration": 899
    },
    {
        "description": "Deber??a mostrar mensajes de requerido|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 1568,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00c5000c-00e9-005b-00ed-009a005e00f0.png",
        "timestamp": 1615919138390,
        "duration": 189
    },
    {
        "description": "deber??a mostrar p??gina de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 14052,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00820076-0047-0059-0017-00f100c10042.png",
        "timestamp": 1615919271863,
        "duration": 2303
    },
    {
        "description": "deber??a mostrar p??gina de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 17396,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "006a00ae-00a2-0038-00dd-007000ad00bd.png",
        "timestamp": 1615920147718,
        "duration": 923
    },
    {
        "description": "deber??a mostrar p??gina de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 10904,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00f000f3-0081-0038-00a4-008d00f500f6.png",
        "timestamp": 1615921967086,
        "duration": 795
    },
    {
        "description": "deber??a mostrar mensajes de requerido|work-space project login",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 10904,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Expected undefined to equal 'El email es obligatorio'."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\test\\login.e2e-spec.ts:16:38)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1615921968114,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1615921968115,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1615921969225,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1615921969226,
                "type": ""
            }
        ],
        "screenShotFile": "00c2003d-004e-00a8-00f3-00b0008c00e5.png",
        "timestamp": 1615921968396,
        "duration": 883
    },
    {
        "description": "deber??a mostrar p??gina de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9500,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00640000-0049-001d-0025-00bb002b0079.png",
        "timestamp": 1615922105090,
        "duration": 896
    },
    {
        "description": "deber??a mostrar mensajes de requerido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9500,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "002b00e7-008d-0092-005f-005700f10027.png",
        "timestamp": 1615922106455,
        "duration": 893
    },
    {
        "description": "deber??a mostrar p??gina de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 15536,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00db0065-0013-0078-004b-00bf00c80096.png",
        "timestamp": 1615922126321,
        "duration": 1486
    },
    {
        "description": "deber??a mostrar mensajes de requerido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 15536,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00ee00a7-00cc-0099-00a5-00ad00f700bf.png",
        "timestamp": 1615922128273,
        "duration": 906
    },
    {
        "description": "deber??a mostrar p??gina de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 16812,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "004100d0-0025-00a5-00fc-008200b10037.png",
        "timestamp": 1615922178615,
        "duration": 6448
    },
    {
        "description": "deber??a mostrar mensajes de requerido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 16812,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "003300d8-0065-0012-00d7-0058000b00ad.png",
        "timestamp": 1615922185511,
        "duration": 860
    },
    {
        "description": "deber??a mostrar p??gina de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 14380,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00010022-000b-00ec-00d9-004a003900da.png",
        "timestamp": 1615923248262,
        "duration": 934
    },
    {
        "description": "deber??a mostrar mensajes de requerido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 14380,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1615923249315,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1615923249317,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1615923250854,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1615923250854,
                "type": ""
            }
        ],
        "screenShotFile": "008200aa-0061-0006-00c6-009300b10068.png",
        "timestamp": 1615923250046,
        "duration": 1188
    },
    {
        "description": "deber??a mostrar p??gina de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 10552,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00d900df-0017-002e-00ae-00e000ec000b.png",
        "timestamp": 1615923309128,
        "duration": 912
    },
    {
        "description": "deber??a mostrar mensajes de requerido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 10552,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1615923310142,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1615923310143,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1615923311346,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1615923311346,
                "type": ""
            }
        ],
        "screenShotFile": "005e00de-00b7-00db-0074-006e00a60025.png",
        "timestamp": 1615923310508,
        "duration": 1167
    },
    {
        "description": "deber??a mostrar p??gina de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 10364,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00d1009a-00c2-00e1-00c0-004900900088.png",
        "timestamp": 1615923359665,
        "duration": 920
    },
    {
        "description": "deber??a mostrar mensajes de requerido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 10364,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1615923360703,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1615923360704,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1615923361898,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1615923361899,
                "type": ""
            }
        ],
        "screenShotFile": "002900be-00d9-0066-0058-007200190049.png",
        "timestamp": 1615923361052,
        "duration": 1190
    },
    {
        "description": "deber??a mostrar p??gina de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 6096,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0059009d-006f-00d2-0074-00a5009200c4.png",
        "timestamp": 1615923649085,
        "duration": 2102
    },
    {
        "description": "deber??a mostrar mensajes de requerido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 6096,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1615923651257,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1615923651257,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1615923652461,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1615923652461,
                "type": ""
            }
        ],
        "screenShotFile": "003000f3-0092-0038-0087-0087000300ed.png",
        "timestamp": 1615923651643,
        "duration": 1120
    },
    {
        "description": "deber??a mostrar p??gina de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 15744,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00b40063-00c9-0058-0058-00e800e000f7.png",
        "timestamp": 1615923762706,
        "duration": 799
    },
    {
        "description": "deber??a mostrar mensajes de requerido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 15744,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1615923763713,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1615923763715,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1615923764794,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1615923764794,
                "type": ""
            }
        ],
        "screenShotFile": "005e0085-001b-0086-00ee-00b600af0016.png",
        "timestamp": 1615923763990,
        "duration": 1154
    },
    {
        "description": "deber??a mostrar p??gina de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 4412,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00b3002c-0088-00fa-001f-001b00c80059.png",
        "timestamp": 1615923890233,
        "duration": 917
    },
    {
        "description": "deber??a mostrar mensajes de requerido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 4412,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1615923891232,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1615923891232,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1615923892490,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1615923892490,
                "type": ""
            }
        ],
        "screenShotFile": "00850028-00e8-00d4-000c-006000a1009e.png",
        "timestamp": 1615923891630,
        "duration": 1203
    },
    {
        "description": "deber??a mostrar p??gina de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 12276,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "001200ed-0032-005f-00e7-00fc002e00c3.png",
        "timestamp": 1615924007578,
        "duration": 935
    },
    {
        "description": "deber??a mostrar mensajes de requerido|work-space project login",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 12276,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Expected undefined to equal 'El email es obligatorio'."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\test\\login.e2e-spec.ts:19:39)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1615924008608,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1615924008609,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1615924009829,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1615924009829,
                "type": ""
            }
        ],
        "screenShotFile": "007c002c-0025-008b-0048-00d700f800ae.png",
        "timestamp": 1615924009021,
        "duration": 1047
    },
    {
        "description": "deber??a mostrar p??gina de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 11480,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00f100f9-000e-0039-0022-006e004a0045.png",
        "timestamp": 1615924272009,
        "duration": 824
    },
    {
        "description": "deber??a mostrar mensajes de requerido|work-space project login",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 11480,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Expected undefined to equal 'El email es obligatorio'."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\test\\login.e2e-spec.ts:18:39)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1615924273069,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1615924273070,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1615924274164,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1615924274165,
                "type": ""
            }
        ],
        "screenShotFile": "0049002b-0040-00dc-002a-00dc005f0040.png",
        "timestamp": 1615924273310,
        "duration": 866
    },
    {
        "description": "deber??a mostrar p??gina de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 12816,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "006a006a-00c0-0020-00b0-005a00580044.png",
        "timestamp": 1615924325194,
        "duration": 1750
    },
    {
        "description": "deber??a mostrar mensajes de requerido|work-space project login",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 12816,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Expected undefined to equal 'El email es obligatorio'."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\test\\login.e2e-spec.ts:18:39)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1615924327149,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1615924327150,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1615924328209,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1615924328209,
                "type": ""
            }
        ],
        "screenShotFile": "004b004b-003f-000a-009b-0092009b0079.png",
        "timestamp": 1615924327426,
        "duration": 941
    },
    {
        "description": "deber??a mostrar p??gina de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 18680,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00ad00f3-005b-00a4-00e8-007a00e2007c.png",
        "timestamp": 1615924991831,
        "duration": 974
    },
    {
        "description": "deber??a mostrar mensajes de requerido|work-space project login",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 18680,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Expected undefined to be truthy."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\test\\login.e2e-spec.ts:17:39)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1615924992906,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1615924992906,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1615924994137,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1615924994138,
                "type": ""
            }
        ],
        "screenShotFile": "00b6003d-00c8-00af-00f7-00f0007f005f.png",
        "timestamp": 1615924993281,
        "duration": 915
    },
    {
        "description": "deber??a mostrar p??gina de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 18424,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00670039-0027-003b-00f2-001800c800ad.png",
        "timestamp": 1615925098938,
        "duration": 930
    },
    {
        "description": "deber??a mostrar mensajes de requerido|work-space project login",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 18424,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Expected undefined to be truthy."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\test\\login.e2e-spec.ts:21:22)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1615925099968,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1615925099969,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1615925101187,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1615925101187,
                "type": ""
            }
        ],
        "screenShotFile": "00700064-0020-00c6-007a-009c0098005a.png",
        "timestamp": 1615925100356,
        "duration": 918
    },
    {
        "description": "deber??a mostrar p??gina de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 10668,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0077001f-00e6-0040-006a-001c00b500ee.png",
        "timestamp": 1615926174051,
        "duration": 911
    },
    {
        "description": "deber??a mostrar mensajes de requerido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 10668,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "005b00f1-0081-00d0-0072-001a00ac0010.png",
        "timestamp": 1615926175445,
        "duration": 1026
    },
    {
        "description": "deber??a mostrar p??gina de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 12992,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00a80024-00b6-00fb-00af-005d000200d6.png",
        "timestamp": 1615926298630,
        "duration": 805
    },
    {
        "description": "deber??a mostrar mensajes de requerido|work-space project login",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 12992,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Expected 'El email es obligatorio' to equal 'El email es obligario'."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\test\\login.e2e-spec.ts:20:22)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7"
        ],
        "browserLogs": [],
        "screenShotFile": "00060054-0072-00ad-00b1-00c000430017.png",
        "timestamp": 1615926299924,
        "duration": 912
    },
    {
        "description": "deber??a mostrar p??gina de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 18372,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00ff0033-00be-0035-0018-005700610041.png",
        "timestamp": 1615926351023,
        "duration": 941
    },
    {
        "description": "deber??a mostrar mensajes de requerido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 18372,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0055002c-00a4-005a-00c1-008700660068.png",
        "timestamp": 1615926352451,
        "duration": 966
    },
    {
        "description": "deber??a mostrar p??gina de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 7648,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00f600c4-00c6-0036-0084-0055005e0031.png",
        "timestamp": 1615926552830,
        "duration": 915
    },
    {
        "description": "deber??a mostrar mensajes de requerido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 7648,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0008007f-0039-0021-005b-005b00c7004d.png",
        "timestamp": 1615926554234,
        "duration": 780
    },
    {
        "description": "deber??a mostrar p??gina de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 5112,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0013009b-00e5-0041-005c-00e0004c0069.png",
        "timestamp": 1615926585395,
        "duration": 771
    },
    {
        "description": "deber??a mostrar mensajes de requerido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 5112,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00d30032-00b1-0020-0066-00580017008f.png",
        "timestamp": 1615926586655,
        "duration": 891
    },
    {
        "description": "deber??a mostrar p??gina de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 19136,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00380090-0041-0080-00a9-0080004f00dd.png",
        "timestamp": 1615926768776,
        "duration": 885
    },
    {
        "description": "deber??a mostrar mensajes de requerido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 19136,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "009c006d-0047-0054-0050-00fa00b80057.png",
        "timestamp": 1615926770329,
        "duration": 1095
    },
    {
        "description": "deber??a mostrar p??gina de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 19336,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00a60067-005b-004a-004f-00ea00e10034.png",
        "timestamp": 1615927781914,
        "duration": 892
    },
    {
        "description": "deber??a mostrar mensajes de requerido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 19336,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00c70015-0066-0092-001d-0096007e007c.png",
        "timestamp": 1615927783267,
        "duration": 912
    },
    {
        "description": "muestra mensaje error password requerido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 19336,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "009c00f8-00c0-004f-00d2-000e00cf001a.png",
        "timestamp": 1615927784471,
        "duration": 955
    },
    {
        "description": "deber??a mostrar p??gina de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 18692,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "007e0072-0036-00dc-00cc-00af00c00020.png",
        "timestamp": 1615928089335,
        "duration": 889
    },
    {
        "description": "deber??a mostrar mensaje error email requerido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 18692,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0020009b-00bd-0016-001e-00cb00f60004.png",
        "timestamp": 1615928090693,
        "duration": 916
    },
    {
        "description": "deber??a mostrar mensaje error email no valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 18692,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "003000df-0026-0085-00cc-00fd00990027.png",
        "timestamp": 1615928091937,
        "duration": 816
    },
    {
        "description": "muestra mensaje error password requerido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 18692,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "001300f7-0053-0056-0030-000e00390048.png",
        "timestamp": 1615928093042,
        "duration": 900
    },
    {
        "description": "deber??a mostrar p??gina de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9140,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0050003c-00e6-00db-0028-008f00a800e7.png",
        "timestamp": 1615928128537,
        "duration": 797
    },
    {
        "description": "deber??a mostrar mensaje error email requerido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9140,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "001e0010-005c-0016-00d7-00610065001a.png",
        "timestamp": 1615928129830,
        "duration": 851
    },
    {
        "description": "deber??a mostrar p??gina de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9596,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00280060-001f-00f1-0066-005a00d9002e.png",
        "timestamp": 1615928157981,
        "duration": 772
    },
    {
        "description": "deber??a mostrar mensaje error email requerido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9596,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "001c0010-004b-00dd-007d-009e008d0016.png",
        "timestamp": 1615928159258,
        "duration": 769
    },
    {
        "description": "deber??a mostrar mensaje error email no valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9596,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "003600db-0028-0032-0052-005c00020070.png",
        "timestamp": 1615928160339,
        "duration": 200
    },
    {
        "description": "muestra mensaje error password requerido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9596,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "0014003a-0018-0063-00fc-0089009300ce.png",
        "timestamp": 1615928160860,
        "duration": 180
    },
    {
        "description": "deber??a mostrar p??gina de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 15996,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "000f00f1-0098-0058-0021-00410045007e.png",
        "timestamp": 1615928675428,
        "duration": 1972
    },
    {
        "description": "deber??a mostrar mensaje error email requerido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 15996,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00f30073-000a-0049-0093-0017004400be.png",
        "timestamp": 1615928677934,
        "duration": 966
    },
    {
        "description": "deber??a mostrar mensaje error email no valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 15996,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00fe00d7-0057-00f0-00af-003800aa00f0.png",
        "timestamp": 1615928679228,
        "duration": 5204
    },
    {
        "description": "muestra mensaje error password requerido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 15996,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00640092-005b-005e-00d2-001f00630079.png",
        "timestamp": 1615928684754,
        "duration": 187
    },
    {
        "description": "deber??a mostrar p??gina de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 5140,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00680006-00ba-004e-00e5-000e00f400f9.png",
        "timestamp": 1615928919464,
        "duration": 1123
    },
    {
        "description": "deber??a mostrar mensaje error email requerido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 5140,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "002600ab-00d0-0081-00ae-00ef00f50096.png",
        "timestamp": 1615928921104,
        "duration": 991
    },
    {
        "description": "deber??a mostrar mensaje error email no valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 5140,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00d0000a-004d-00b9-0092-0071009a00b1.png",
        "timestamp": 1615928922413,
        "duration": 5213
    },
    {
        "description": "muestra mensaje error password requerido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 5140,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00730082-00f6-0023-005b-0029007900c8.png",
        "timestamp": 1615928927904,
        "duration": 189
    },
    {
        "description": "deber??a mostrar p??gina de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 19160,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "006400eb-003c-0023-0037-007f003800f4.png",
        "timestamp": 1615928935734,
        "duration": 1194
    },
    {
        "description": "deber??a mostrar mensaje error email requerido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 19160,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00980096-007c-004e-00ea-00b300490083.png",
        "timestamp": 1615928937395,
        "duration": 933
    },
    {
        "description": "deber??a mostrar mensaje error email no valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 19160,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "000f00df-00ba-0059-0077-007b00b200be.png",
        "timestamp": 1615928938624,
        "duration": 5210
    },
    {
        "description": "muestra mensaje error password requerido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 19160,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00050009-0012-00fe-0062-0062007900e4.png",
        "timestamp": 1615928944095,
        "duration": 183
    },
    {
        "description": "deber??a mostrar p??gina de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 11160,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0071002a-005d-0002-008b-007800cd0009.png",
        "timestamp": 1615929017855,
        "duration": 823
    },
    {
        "description": "deber??a mostrar mensaje error email no valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 11160,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00d400d5-001c-0037-0052-00a40045009c.png",
        "timestamp": 1615929019209,
        "duration": 6008
    },
    {
        "description": "deber??a mostrar p??gina de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 5208,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00d200ae-007a-00d5-0094-000c008a002b.png",
        "timestamp": 1615929042091,
        "duration": 935
    },
    {
        "description": "deber??a mostrar mensaje error email no valido|work-space project login",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 5208,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Expected 'El email es obligatorio' to equal 'Ingrese un email v??lido'."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\test\\login.e2e-spec.ts:34:27)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7"
        ],
        "browserLogs": [],
        "screenShotFile": "00cb003a-0065-002c-00cc-00e800ee0094.png",
        "timestamp": 1615929043515,
        "duration": 6014
    },
    {
        "description": "deber??a mostrar p??gina de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 14436,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "009b00cb-00a9-00d8-008b-009c000d00a9.png",
        "timestamp": 1615929078663,
        "duration": 929
    },
    {
        "description": "deber??a mostrar mensaje error email no valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 14436,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00bb00b0-001f-00ac-006d-008c001d00e7.png",
        "timestamp": 1615929080077,
        "duration": 5987
    },
    {
        "description": "deber??a mostrar p??gina de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 2864,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "001e00b6-006e-006d-00c4-008d006a0023.png",
        "timestamp": 1615930302653,
        "duration": 805
    },
    {
        "description": "deber??a mostrar p??gina de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3480,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "009400cf-0042-003e-0004-004e009e00c7.png",
        "timestamp": 1615932006387,
        "duration": 914
    },
    {
        "description": "deber??a mostrar mensaje error email requerido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3480,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "004b0076-0044-00e6-00cf-000600610042.png",
        "timestamp": 1615932008276,
        "duration": 828
    },
    {
        "description": "deber??a mostrar p??gina de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3984,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00f40003-006e-0006-00fe-001900fa003c.png",
        "timestamp": 1615932075519,
        "duration": 28093
    },
    {
        "description": "deber??a mostrar mensaje error email requerido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3984,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "004e0011-00cd-00b8-0066-00b800a00062.png",
        "timestamp": 1615932104071,
        "duration": 682
    },
    {
        "description": "deber??a mostrar mensaje error email no valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3984,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "003400c1-007f-00c6-0014-003f00a0001b.png",
        "timestamp": 1615932105066,
        "duration": 872
    },
    {
        "description": "deber??a mostrar p??gina de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 20816,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00490027-00d4-0096-000f-00be00710066.png",
        "timestamp": 1615932142531,
        "duration": 18776
    },
    {
        "description": "deber??a mostrar mensaje error email requerido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 20816,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "005e00d8-00a0-0006-0037-000d00d100a0.png",
        "timestamp": 1615932161818,
        "duration": 941
    },
    {
        "description": "deber??a mostrar mensaje error email no valido|work-space project login",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 20816,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Expected 'Ingrese un email v??lido' to be falsy."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\test\\login.e2e-spec.ts:32:27)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7"
        ],
        "browserLogs": [],
        "screenShotFile": "004c00c3-008d-00e3-00b5-002f003300cc.png",
        "timestamp": 1615932163098,
        "duration": 973
    },
    {
        "description": "deber??a mostrar p??gina de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 13364,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "005a0079-00d6-0039-0086-002400f80084.png",
        "timestamp": 1615932206869,
        "duration": 4474
    },
    {
        "description": "deber??a mostrar mensaje error email requerido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 13364,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "000f009e-00a0-0069-00d1-0008002d0058.png",
        "timestamp": 1615932211855,
        "duration": 783
    },
    {
        "description": "deber??a mostrar mensaje error email no valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 13364,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "009900cf-0010-00ba-0089-003b00fe008a.png",
        "timestamp": 1615932212963,
        "duration": 981
    },
    {
        "description": "deber??a mostrar p??gina de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 20924,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "008100d7-0041-00a9-002d-0046000f00b6.png",
        "timestamp": 1615932273876,
        "duration": 18962
    },
    {
        "description": "deber??a mostrar mensaje error email requerido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 20924,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00180087-00bd-006f-008c-002e002d0056.png",
        "timestamp": 1615932293351,
        "duration": 836
    },
    {
        "description": "deber??a mostrar mensaje error email no valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 20924,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00ee00bb-007c-0041-005b-00de009d0038.png",
        "timestamp": 1615932294526,
        "duration": 979
    },
    {
        "description": "muestra mensaje error password requerido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 20924,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "000500d3-0064-00dd-00b8-00ca00a800fc.png",
        "timestamp": 1615932295831,
        "duration": 859
    },
    {
        "description": "deber??a mostrar p??gina de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 11356,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0058009b-00c4-00d4-008a-000000f40093.png",
        "timestamp": 1615934187880,
        "duration": 19253
    },
    {
        "description": "deber??a mostrar mensaje error email requerido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 11356,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "005c0056-00d9-003e-00ee-00d7009d00a1.png",
        "timestamp": 1615934207617,
        "duration": 926
    },
    {
        "description": "deber??a mostrar mensaje error email no valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 11356,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00b40087-00f3-0093-0009-001700e200fe.png",
        "timestamp": 1615934208879,
        "duration": 992
    },
    {
        "description": "muestra mensaje error password requerido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 11356,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00a9006b-00ff-0026-00da-00b000520069.png",
        "timestamp": 1615934210212,
        "duration": 790
    },
    {
        "description": "redirecciona a la p??gina de home si login es valido|work-space project login",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 11356,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: Angular could not be found on the page http://localhost:4200/home. If this is not an Angular application, you may need to turn off waiting for Angular.\n                          Please see \n                          https://github.com/angular/protractor/blob/master/docs/timeouts.md#waiting-for-angular-on-page-load"
        ],
        "trace": [
            "Error: Angular could not be found on the page http://localhost:4200/home. If this is not an Angular application, you may need to turn off waiting for Angular.\n                          Please see \n                          https://github.com/angular/protractor/blob/master/docs/timeouts.md#waiting-for-angular-on-page-load\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:718:27\n    at ManagedPromise.invokeCallback_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: Run it(\"redirecciona a la p??gina de home si login es valido\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError: \n    at Suite.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\test\\login.e2e-spec.ts:49:3)\n    at addSpecsToSuite (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\test\\login.e2e-spec.ts:4:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Module.m._compile (D:\\Proyectos\\ADNCeiba\\angular-base\\node_modules\\ts-node\\src\\index.ts:439:23)\n    at Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Object.require.extensions.<computed> [as .ts] (D:\\Proyectos\\ADNCeiba\\angular-base\\node_modules\\ts-node\\src\\index.ts:442:12)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/home - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1615934212487,
                "type": ""
            }
        ],
        "screenShotFile": "0049003b-000e-008d-0090-00af003800d8.png",
        "timestamp": 1615934211299,
        "duration": 11408
    },
    {
        "description": "deber??a mostrar p??gina de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 14716,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00440004-007d-0039-0059-00ff00d2000b.png",
        "timestamp": 1615934358151,
        "duration": 21285
    },
    {
        "description": "deber??a mostrar mensaje error email requerido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 14716,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00c00015-0034-0002-00b4-009400e5005b.png",
        "timestamp": 1615934379935,
        "duration": 950
    },
    {
        "description": "deber??a mostrar mensaje error email no valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 14716,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "008e0049-006e-0066-00fb-002600e80006.png",
        "timestamp": 1615934381212,
        "duration": 986
    },
    {
        "description": "muestra mensaje error password requerido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 14716,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "001f00ef-002d-008b-0051-009b00b100c0.png",
        "timestamp": 1615934382538,
        "duration": 886
    },
    {
        "description": "redirecciona a la p??gina de home si login es valido|work-space project login",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 14716,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: Angular could not be found on the page http://localhost:4200/home. If this is not an Angular application, you may need to turn off waiting for Angular.\n                          Please see \n                          https://github.com/angular/protractor/blob/master/docs/timeouts.md#waiting-for-angular-on-page-load"
        ],
        "trace": [
            "Error: Angular could not be found on the page http://localhost:4200/home. If this is not an Angular application, you may need to turn off waiting for Angular.\n                          Please see \n                          https://github.com/angular/protractor/blob/master/docs/timeouts.md#waiting-for-angular-on-page-load\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:718:27\n    at ManagedPromise.invokeCallback_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: Run it(\"redirecciona a la p??gina de home si login es valido\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError: \n    at Suite.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\test\\login.e2e-spec.ts:49:3)\n    at addSpecsToSuite (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\test\\login.e2e-spec.ts:4:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Module.m._compile (D:\\Proyectos\\ADNCeiba\\angular-base\\node_modules\\ts-node\\src\\index.ts:439:23)\n    at Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Object.require.extensions.<computed> [as .ts] (D:\\Proyectos\\ADNCeiba\\angular-base\\node_modules\\ts-node\\src\\index.ts:442:12)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/home - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1615934384913,
                "type": ""
            }
        ],
        "screenShotFile": "008f00cc-00a5-00ac-006a-002000d000a0.png",
        "timestamp": 1615934383751,
        "duration": 11413
    },
    {
        "description": "deber??a mostrar p??gina de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 21156,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00c000f1-0051-0032-002c-00b300fc007d.png",
        "timestamp": 1615937593279,
        "duration": 2637
    },
    {
        "description": "deber??a mostrar mensaje error email requerido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 21156,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00130044-006a-00de-00d7-0009005400db.png",
        "timestamp": 1615937596663,
        "duration": 965
    },
    {
        "description": "deber??a mostrar mensaje error email no valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 21156,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00ff0093-00e9-008e-0014-006c002800af.png",
        "timestamp": 1615937597941,
        "duration": 971
    },
    {
        "description": "muestra mensaje error password requerido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 21156,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "004f0099-00fc-003a-00c0-0008004f00e3.png",
        "timestamp": 1615937599201,
        "duration": 908
    },
    {
        "description": "Deber??a mostrar mensajes de requerido|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 21156,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "007e00c7-0085-008b-00d0-00d8008b00b9.png",
        "timestamp": 1615937600399,
        "duration": 174
    },
    {
        "description": "deber??a mostrar p??gina de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 17836,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00c30026-00c4-0005-0022-0072004c00eb.png",
        "timestamp": 1615937630426,
        "duration": 810
    },
    {
        "description": "deber??a mostrar mensaje error email requerido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 17836,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0070005b-001c-009f-0099-00e0002200d2.png",
        "timestamp": 1615937631729,
        "duration": 924
    },
    {
        "description": "deber??a mostrar mensaje error email no valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 17836,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "000a00e5-00d1-00f9-0073-007800af00c9.png",
        "timestamp": 1615937632976,
        "duration": 887
    },
    {
        "description": "muestra mensaje error password requerido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 17836,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "005400a1-0055-0061-0013-001e001900d1.png",
        "timestamp": 1615937634200,
        "duration": 1010
    },
    {
        "description": "Deber??a mostrar mensaje ISB requerido|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 17836,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "0027001b-00bd-00e2-0017-00cd003100be.png",
        "timestamp": 1615937635504,
        "duration": 172
    },
    {
        "description": "deber??a mostrar p??gina de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 18456,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00560039-00e0-0074-00bf-0006008200c1.png",
        "timestamp": 1615938742797,
        "duration": 3386
    },
    {
        "description": "deber??a mostrar mensaje error email obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 18456,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "003c008c-00fd-0034-00ec-006d002f008b.png",
        "timestamp": 1615938746683,
        "duration": 949
    },
    {
        "description": "deber??a mostrar mensaje error email no valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 18456,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00580039-0015-0098-000a-004b001900df.png",
        "timestamp": 1615938747939,
        "duration": 954
    },
    {
        "description": "muestra mensaje error password obligatorio|work-space project login",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 18456,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Expected 'El password es obligatorio' to equal 'El password es obligatobligatorioorio'."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\test\\login.e2e-spec.ts:46:21)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7"
        ],
        "browserLogs": [],
        "screenShotFile": "001800f7-0058-0069-00ee-00b800cc007e.png",
        "timestamp": 1615938749187,
        "duration": 898
    },
    {
        "description": "deber??a mostrar p??gina de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3116,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "004400e4-003b-0054-0074-00cb0048009a.png",
        "timestamp": 1615938788143,
        "duration": 856
    },
    {
        "description": "deber??a mostrar mensaje error email obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3116,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "006d0095-007b-003f-0078-008a00ed006a.png",
        "timestamp": 1615938789469,
        "duration": 921
    },
    {
        "description": "deber??a mostrar mensaje error email no valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3116,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0090000a-007b-0092-001a-0071004c00b5.png",
        "timestamp": 1615938790703,
        "duration": 999
    },
    {
        "description": "muestra mensaje error password obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3116,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0071008b-0036-00e0-002b-002b00810019.png",
        "timestamp": 1615938791977,
        "duration": 916
    },
    {
        "description": "deber??a mostrar p??gina de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 20024,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00b500d5-0032-0018-004d-00fd00c500ee.png",
        "timestamp": 1615938907041,
        "duration": 799
    },
    {
        "description": "deber??a mostrar mensaje error email obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 20024,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00160049-002a-0067-007e-00cb00c80015.png",
        "timestamp": 1615938908424,
        "duration": 875
    },
    {
        "description": "deber??a mostrar mensaje error email no valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 20024,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00d400f0-000f-00b3-007f-003a00df00f6.png",
        "timestamp": 1615938909620,
        "duration": 853
    },
    {
        "description": "muestra mensaje error password obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 20024,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00ba005e-008c-007a-00ae-006c0069006c.png",
        "timestamp": 1615938910747,
        "duration": 983
    },
    {
        "description": "Deber??a mostrar mensaje ISBN obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 20024,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00fd0020-004a-0071-005c-009600a8009e.png",
        "timestamp": 1615938912029,
        "duration": 173
    },
    {
        "description": "Muestra mensaje error Nombre obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 20024,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00fd00a1-00cf-00fe-00d1-0075003f0085.png",
        "timestamp": 1615938912493,
        "duration": 131
    },
    {
        "description": "deber??a mostrar p??gina de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 12588,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00d60091-002b-00ba-003e-0001005400a6.png",
        "timestamp": 1615940429303,
        "duration": 794
    },
    {
        "description": "deber??a mostrar mensaje error email obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 12588,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "002500eb-0096-0001-008a-00b7007e00bb.png",
        "timestamp": 1615940430614,
        "duration": 997
    },
    {
        "description": "deber??a mostrar mensaje error email no valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 12588,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00030092-006f-0014-00af-009100a80069.png",
        "timestamp": 1615940431929,
        "duration": 996
    },
    {
        "description": "muestra mensaje error password obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 12588,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00da0032-0086-0041-0082-0041006300b0.png",
        "timestamp": 1615940433206,
        "duration": 788
    },
    {
        "description": "redirecciona a la p??gina de home si login es valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 12588,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00f600cd-0053-00ac-008e-007f004e009c.png",
        "timestamp": 1615940434283,
        "duration": 5350
    },
    {
        "description": "Deber??a mostrar mensaje ISBN obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 12588,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00b1000e-008d-002c-0041-00cb00ef00d3.png",
        "timestamp": 1615940439911,
        "duration": 652
    },
    {
        "description": "Muestra mensaje error Nombre obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 12588,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "004f00e8-0069-00fd-00fb-007d00d700cf.png",
        "timestamp": 1615940440873,
        "duration": 201
    },
    {
        "description": "deber??a mostrar p??gina de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 18712,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00a10044-000e-0071-00a7-000200da0007.png",
        "timestamp": 1615940504971,
        "duration": 28037
    },
    {
        "description": "deber??a mostrar mensaje error email obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 18712,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "003000f1-0035-006d-003e-005f001d00f0.png",
        "timestamp": 1615940533519,
        "duration": 929
    },
    {
        "description": "deber??a mostrar mensaje error email no valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 18712,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00fd0070-00fb-008d-00e6-00cc003500cb.png",
        "timestamp": 1615940534782,
        "duration": 855
    },
    {
        "description": "muestra mensaje error password obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 18712,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0063004f-00a7-0004-000d-000b00160044.png",
        "timestamp": 1615940536000,
        "duration": 919
    },
    {
        "description": "redirecciona a la p??gina de home si login es valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 18712,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00ff0064-00af-0024-0056-003400e60035.png",
        "timestamp": 1615940537242,
        "duration": 1895
    },
    {
        "description": "Deber??a mostrar mensaje ISBN obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 18712,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00d8001b-0078-00b1-0070-009500970071.png",
        "timestamp": 1615940539470,
        "duration": 103
    },
    {
        "description": "Muestra mensaje error Nombre obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 18712,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "007a009a-00d0-0090-00ec-00f7005000d6.png",
        "timestamp": 1615940539893,
        "duration": 299
    },
    {
        "description": "deber??a mostrar p??gina de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 19324,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "003e0037-00d1-001d-002c-005200390092.png",
        "timestamp": 1615983348470,
        "duration": 1092
    },
    {
        "description": "deber??a mostrar mensaje error email obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 19324,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "003e0074-0069-00e2-00ca-008700ba009f.png",
        "timestamp": 1615983350448,
        "duration": 961
    },
    {
        "description": "deber??a mostrar mensaje error email no valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 19324,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00540013-0011-005c-005c-00620056002c.png",
        "timestamp": 1615983351754,
        "duration": 983
    },
    {
        "description": "muestra mensaje error password obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 19324,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00c60063-00c9-001e-00f5-001f00f40087.png",
        "timestamp": 1615983353065,
        "duration": 917
    },
    {
        "description": "redirecciona a la p??gina de home si login es valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 19324,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00e600d0-009d-0046-0072-00f6006b0055.png",
        "timestamp": 1615983354303,
        "duration": 2042
    },
    {
        "description": "Deber??a mostrar mensaje ISBN obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 19324,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00e80065-00c0-004d-003d-009b00260086.png",
        "timestamp": 1615983356647,
        "duration": 114
    },
    {
        "description": "Muestra mensaje error Nombre obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 19324,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "000400ba-00a7-008f-005f-004300bd007e.png",
        "timestamp": 1615983357066,
        "duration": 567
    },
    {
        "description": "deber??a mostrar p??gina de login|workspace-project App",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 14484,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Expected null to be truthy."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\app.e2e-spec.ts:12:31)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7"
        ],
        "browserLogs": [],
        "screenShotFile": "00d70022-001f-00dc-00b5-009100f40078.png",
        "timestamp": 1615983975093,
        "duration": 917
    },
    {
        "description": "deber??a mostrar mensaje error email obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 14484,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0001004c-0065-006f-00a9-004500da0000.png",
        "timestamp": 1615983976532,
        "duration": 1059
    },
    {
        "description": "deber??a mostrar mensaje error email no valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 14484,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "009e0097-0053-005c-00ed-0044001b0093.png",
        "timestamp": 1615983977925,
        "duration": 1086
    },
    {
        "description": "muestra mensaje error password obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 14484,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00900046-00c3-00d1-0051-00d700ae00c7.png",
        "timestamp": 1615983979370,
        "duration": 1173
    },
    {
        "description": "redirecciona a la p??gina de home si login es valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 14484,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "000b00d3-002b-00f7-00a3-00a000a40057.png",
        "timestamp": 1615983980897,
        "duration": 2426
    },
    {
        "description": "Deber??a mostrar mensaje ISBN obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 14484,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00010036-008b-003f-007e-008f00590059.png",
        "timestamp": 1615983983658,
        "duration": 138
    },
    {
        "description": "Muestra mensaje error Nombre obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 14484,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00a500a1-0029-00b8-00a4-0055001800bb.png",
        "timestamp": 1615983984135,
        "duration": 157
    },
    {
        "description": "deber??a mostrar p??gina de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 5768,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00b6003a-0023-0057-0075-00a500f700ca.png",
        "timestamp": 1615984541275,
        "duration": 1033
    },
    {
        "description": "deber??a mostrar mensaje error email obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 5768,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00bd006d-009e-001b-0093-00c000f3002f.png",
        "timestamp": 1615984542855,
        "duration": 887
    },
    {
        "description": "deber??a mostrar mensaje error email no valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 5768,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00ce007c-00d5-0054-00df-006100cd00bf.png",
        "timestamp": 1615984544053,
        "duration": 971
    },
    {
        "description": "muestra mensaje error password obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 5768,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00340025-003d-005f-008d-00cb00ff0078.png",
        "timestamp": 1615984545322,
        "duration": 939
    },
    {
        "description": "redirecciona a la p??gina de home si login es valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 5768,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00640047-00f6-0050-0064-00fc007d0070.png",
        "timestamp": 1615984546586,
        "duration": 1988
    },
    {
        "description": "Deber??a mostrar mensaje ISBN obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 5768,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "001c007a-0011-0017-009e-002d005f00e9.png",
        "timestamp": 1615984548983,
        "duration": 176
    },
    {
        "description": "Muestra mensaje error Nombre obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 5768,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00e40097-00e7-006c-00f9-003e00280065.png",
        "timestamp": 1615984549475,
        "duration": 127
    },
    {
        "description": "deber??a mostrar p??gina de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 18884,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00710027-00ad-008d-0037-0020003b00cc.png",
        "timestamp": 1615985039844,
        "duration": 1292
    },
    {
        "description": "deber??a mostrar mensaje error email obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 18884,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00d80016-002f-00c1-001d-000d00570098.png",
        "timestamp": 1615985041836,
        "duration": 1185
    },
    {
        "description": "deber??a mostrar mensaje error email no valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 18884,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00670031-0028-001f-0085-001500470083.png",
        "timestamp": 1615985043344,
        "duration": 1056
    },
    {
        "description": "muestra mensaje error password obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 18884,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00a700ae-0000-007f-0049-000400960046.png",
        "timestamp": 1615985044752,
        "duration": 966
    },
    {
        "description": "redirecciona a la p??gina de home si login es valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 18884,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00630054-00db-00ad-00fe-00ba005c00c3.png",
        "timestamp": 1615985046071,
        "duration": 2143
    },
    {
        "description": "Deber??a mostrar mensaje ISBN obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 18884,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00d0000b-00fd-0084-00c8-00ad00a3009a.png",
        "timestamp": 1615985048537,
        "duration": 111
    },
    {
        "description": "Muestra mensaje error Nombre obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 18884,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "005e001d-0070-001b-00f4-007e00ac00b3.png",
        "timestamp": 1615985048953,
        "duration": 107
    },
    {
        "description": "deber??a mostrar p??gina de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3500,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00d2007f-0087-004d-00de-0031002e0097.png",
        "timestamp": 1615985662050,
        "duration": 804
    },
    {
        "description": "deber??a mostrar mensaje error email obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3500,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00dd007b-0089-00f8-0099-0065008c0036.png",
        "timestamp": 1615985663376,
        "duration": 918
    },
    {
        "description": "deber??a mostrar mensaje error email no valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3500,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "000b0048-00a0-0093-0047-000b003a00b6.png",
        "timestamp": 1615985664601,
        "duration": 916
    },
    {
        "description": "muestra mensaje error password obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3500,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00a200e9-0090-0030-00bb-0069006100e4.png",
        "timestamp": 1615985665872,
        "duration": 1177
    },
    {
        "description": "redirecciona a la p??gina de home si login es valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3500,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "005700a7-0056-000e-007c-007a00c2000b.png",
        "timestamp": 1615985667401,
        "duration": 2204
    },
    {
        "description": "Deber??a mostrar mensaje ISBN obligatorio|workspace-project Prestamo",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 3500,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: protractor_1.browser.addCookie is not a function"
        ],
        "trace": [
            "TypeError: protractor_1.browser.addCookie is not a function\n    at UserContext.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\test\\prestamo.e2e-spec.ts:12:13)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: Run beforeEach in control flow\n    at UserContext.<anonymous> (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError: \n    at Suite.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\test\\prestamo.e2e-spec.ts:10:3)\n    at addSpecsToSuite (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\test\\prestamo.e2e-spec.ts:7:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Module.m._compile (D:\\Proyectos\\ADNCeiba\\angular-base\\node_modules\\ts-node\\src\\index.ts:439:23)\n    at Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Object.require.extensions.<computed> [as .ts] (D:\\Proyectos\\ADNCeiba\\angular-base\\node_modules\\ts-node\\src\\index.ts:442:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "00b1002e-00e3-005b-0095-00da006b002c.png",
        "timestamp": 1615985669962,
        "duration": 187
    },
    {
        "description": "Muestra mensaje error Nombre obligatorio|workspace-project Prestamo",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 3500,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: protractor_1.browser.addCookie is not a function"
        ],
        "trace": [
            "TypeError: protractor_1.browser.addCookie is not a function\n    at UserContext.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\test\\prestamo.e2e-spec.ts:12:13)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: Run beforeEach in control flow\n    at UserContext.<anonymous> (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError: \n    at Suite.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\test\\prestamo.e2e-spec.ts:10:3)\n    at addSpecsToSuite (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\test\\prestamo.e2e-spec.ts:7:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Module.m._compile (D:\\Proyectos\\ADNCeiba\\angular-base\\node_modules\\ts-node\\src\\index.ts:439:23)\n    at Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Object.require.extensions.<computed> [as .ts] (D:\\Proyectos\\ADNCeiba\\angular-base\\node_modules\\ts-node\\src\\index.ts:442:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "003b0097-001c-0034-0003-004500ec00f2.png",
        "timestamp": 1615985670486,
        "duration": 120
    },
    {
        "description": "deber??a mostrar p??gina de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9132,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00b20037-00cf-00e9-0012-0066001a001d.png",
        "timestamp": 1615987145304,
        "duration": 890
    },
    {
        "description": "deber??a mostrar mensaje error email obligatorio|work-space project login",
        "passed": false,
        "pending": true,
        "os": "Windows",
        "instanceId": 9132,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Pending",
        "browserLogs": [],
        "screenShotFile": "00e700ec-003e-0052-0029-0014002b0039.png",
        "timestamp": 1615987147000,
        "duration": 0
    },
    {
        "description": "deber??a mostrar mensaje error email no valido|work-space project login",
        "passed": false,
        "pending": true,
        "os": "Windows",
        "instanceId": 9132,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Pending",
        "browserLogs": [],
        "screenShotFile": "00cf00fc-000e-0024-0046-009a008900f1.png",
        "timestamp": 1615987147028,
        "duration": 0
    },
    {
        "description": "muestra mensaje error password obligatorio|work-space project login",
        "passed": false,
        "pending": true,
        "os": "Windows",
        "instanceId": 9132,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Pending",
        "browserLogs": [],
        "screenShotFile": "00990063-00b9-00bd-00e1-00cc000b004f.png",
        "timestamp": 1615987147060,
        "duration": 0
    },
    {
        "description": "redirecciona a la p??gina de home si login es valido|work-space project login",
        "passed": false,
        "pending": true,
        "os": "Windows",
        "instanceId": 9132,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Pending",
        "browserLogs": [],
        "screenShotFile": "00020018-0024-0051-002f-00a1007e00e8.png",
        "timestamp": 1615987147080,
        "duration": 0
    },
    {
        "description": "Deber??a mostrar mensaje ISBN obligatorio|workspace-project Prestamo",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 9132,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: invalid argument\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.19042 x86_64)",
            "Expected 'http://localhost:4200/login' to match 'home'."
        ],
        "trace": [
            "WebDriverError: invalid argument\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.19042 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebDriver.navigate().to(home)\n    at Driver.schedule (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at Navigation.to (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:1133:25)\n    at Driver.get (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:988:28)\n    at UserContext.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\test\\prestamo.e2e-spec.ts:12:20)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\nFrom: Task: Run beforeEach in control flow\n    at UserContext.<anonymous> (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError: \n    at Suite.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\test\\prestamo.e2e-spec.ts:10:3)\n    at addSpecsToSuite (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\test\\prestamo.e2e-spec.ts:7:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Module.m._compile (D:\\Proyectos\\ADNCeiba\\angular-base\\node_modules\\ts-node\\src\\index.ts:439:23)\n    at Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Object.require.extensions.<computed> [as .ts] (D:\\Proyectos\\ADNCeiba\\angular-base\\node_modules\\ts-node\\src\\index.ts:442:12)",
            "Error: Failed expectation\n    at UserContext.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\test\\prestamo.e2e-spec.ts:23:37)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7"
        ],
        "browserLogs": [],
        "screenShotFile": "00b90032-00b0-00f4-00c3-0015005d0037.png",
        "timestamp": 1615987147103,
        "duration": 131
    },
    {
        "description": "Muestra mensaje error Nombre obligatorio|workspace-project Prestamo",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 9132,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: invalid argument\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.19042 x86_64)",
            "Expected 'http://localhost:4200/login' to match 'home'."
        ],
        "trace": [
            "WebDriverError: invalid argument\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.19042 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebDriver.navigate().to(home)\n    at Driver.schedule (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at Navigation.to (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:1133:25)\n    at Driver.get (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:988:28)\n    at UserContext.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\test\\prestamo.e2e-spec.ts:12:20)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\nFrom: Task: Run beforeEach in control flow\n    at UserContext.<anonymous> (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError: \n    at Suite.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\test\\prestamo.e2e-spec.ts:10:3)\n    at addSpecsToSuite (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\test\\prestamo.e2e-spec.ts:7:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Module.m._compile (D:\\Proyectos\\ADNCeiba\\angular-base\\node_modules\\ts-node\\src\\index.ts:439:23)\n    at Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Object.require.extensions.<computed> [as .ts] (D:\\Proyectos\\ADNCeiba\\angular-base\\node_modules\\ts-node\\src\\index.ts:442:12)",
            "Error: Failed expectation\n    at UserContext.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\test\\prestamo.e2e-spec.ts:34:37)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7"
        ],
        "browserLogs": [],
        "screenShotFile": "0021006f-00da-00bb-0015-00bb00df0047.png",
        "timestamp": 1615987147561,
        "duration": 110
    },
    {
        "description": "deber??a mostrar p??gina de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 964,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "008b009c-00ad-00aa-006b-004800e9009c.png",
        "timestamp": 1615987177297,
        "duration": 1423
    },
    {
        "description": "deber??a mostrar mensaje error email obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 964,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "002500d7-00d4-004b-008d-0080001d0018.png",
        "timestamp": 1615987179242,
        "duration": 928
    },
    {
        "description": "deber??a mostrar mensaje error email no valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 964,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00a1008a-00c3-0038-0001-0045003b00b4.png",
        "timestamp": 1615987180513,
        "duration": 972
    },
    {
        "description": "muestra mensaje error password obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 964,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00d80050-0055-00c4-0071-0070004d0019.png",
        "timestamp": 1615987181800,
        "duration": 958
    },
    {
        "description": "redirecciona a la p??gina de home si login es valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 964,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00750005-00b0-00e4-0027-001200d5005b.png",
        "timestamp": 1615987183059,
        "duration": 1888
    },
    {
        "description": "Deber??a mostrar mensaje ISBN obligatorio|workspace-project Prestamo",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 964,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: invalid argument\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.19042 x86_64)"
        ],
        "trace": [
            "WebDriverError: invalid argument\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.19042 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebDriver.navigate().to(home)\n    at Driver.schedule (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at Navigation.to (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:1133:25)\n    at Driver.get (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:988:28)\n    at UserContext.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\test\\prestamo.e2e-spec.ts:12:20)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\nFrom: Task: Run beforeEach in control flow\n    at UserContext.<anonymous> (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError: \n    at Suite.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\test\\prestamo.e2e-spec.ts:10:3)\n    at addSpecsToSuite (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\test\\prestamo.e2e-spec.ts:7:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Module.m._compile (D:\\Proyectos\\ADNCeiba\\angular-base\\node_modules\\ts-node\\src\\index.ts:439:23)\n    at Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Object.require.extensions.<computed> [as .ts] (D:\\Proyectos\\ADNCeiba\\angular-base\\node_modules\\ts-node\\src\\index.ts:442:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "00310031-001d-00b2-0065-00c500c4003b.png",
        "timestamp": 1615987185310,
        "duration": 221
    },
    {
        "description": "Muestra mensaje error Nombre obligatorio|workspace-project Prestamo",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 964,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: invalid argument\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.19042 x86_64)"
        ],
        "trace": [
            "WebDriverError: invalid argument\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.19042 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebDriver.navigate().to(home)\n    at Driver.schedule (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at Navigation.to (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:1133:25)\n    at Driver.get (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:988:28)\n    at UserContext.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\test\\prestamo.e2e-spec.ts:12:20)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\nFrom: Task: Run beforeEach in control flow\n    at UserContext.<anonymous> (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError: \n    at Suite.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\test\\prestamo.e2e-spec.ts:10:3)\n    at addSpecsToSuite (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\test\\prestamo.e2e-spec.ts:7:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Module.m._compile (D:\\Proyectos\\ADNCeiba\\angular-base\\node_modules\\ts-node\\src\\index.ts:439:23)\n    at Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Object.require.extensions.<computed> [as .ts] (D:\\Proyectos\\ADNCeiba\\angular-base\\node_modules\\ts-node\\src\\index.ts:442:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "0020005f-00e3-0069-0010-009700820063.png",
        "timestamp": 1615987185871,
        "duration": 146
    },
    {
        "description": "deber??a mostrar p??gina de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 1628,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "003700b2-00b7-00dc-0084-003600ca0099.png",
        "timestamp": 1615987241346,
        "duration": 991
    },
    {
        "description": "deber??a mostrar mensaje error email obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 1628,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00bd00e2-00fa-00cf-0074-00fc00860093.png",
        "timestamp": 1615987243110,
        "duration": 1283
    },
    {
        "description": "deber??a mostrar mensaje error email no valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 1628,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "001200ec-00ec-004e-009f-00620012005e.png",
        "timestamp": 1615987244762,
        "duration": 1094
    },
    {
        "description": "muestra mensaje error password obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 1628,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00d90075-00b8-006e-0098-009100160096.png",
        "timestamp": 1615987246209,
        "duration": 893
    },
    {
        "description": "redirecciona a la p??gina de home si login es valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 1628,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "006200bc-0047-008b-00bc-000c00d600e2.png",
        "timestamp": 1615987247378,
        "duration": 1991
    },
    {
        "description": "Deber??a mostrar mensaje ISBN obligatorio|workspace-project Prestamo",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 1628,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: invalid argument\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.19042 x86_64)"
        ],
        "trace": [
            "WebDriverError: invalid argument\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.19042 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebDriver.navigate().to(home)\n    at Driver.schedule (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at Navigation.to (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:1133:25)\n    at Driver.get (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:988:28)\n    at UserContext.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\test\\prestamo.e2e-spec.ts:12:20)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\nFrom: Task: Run beforeEach in control flow\n    at UserContext.<anonymous> (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError: \n    at Suite.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\test\\prestamo.e2e-spec.ts:10:3)\n    at addSpecsToSuite (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\test\\prestamo.e2e-spec.ts:7:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Module.m._compile (D:\\Proyectos\\ADNCeiba\\angular-base\\node_modules\\ts-node\\src\\index.ts:439:23)\n    at Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Object.require.extensions.<computed> [as .ts] (D:\\Proyectos\\ADNCeiba\\angular-base\\node_modules\\ts-node\\src\\index.ts:442:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "00410098-0021-00af-008a-005b008700af.png",
        "timestamp": 1615987249668,
        "duration": 136
    },
    {
        "description": "Muestra mensaje error Nombre obligatorio|workspace-project Prestamo",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 1628,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: invalid argument\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.19042 x86_64)"
        ],
        "trace": [
            "WebDriverError: invalid argument\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.19042 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebDriver.navigate().to(home)\n    at Driver.schedule (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at Navigation.to (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:1133:25)\n    at Driver.get (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:988:28)\n    at UserContext.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\test\\prestamo.e2e-spec.ts:12:20)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\nFrom: Task: Run beforeEach in control flow\n    at UserContext.<anonymous> (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError: \n    at Suite.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\test\\prestamo.e2e-spec.ts:10:3)\n    at addSpecsToSuite (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\test\\prestamo.e2e-spec.ts:7:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Module.m._compile (D:\\Proyectos\\ADNCeiba\\angular-base\\node_modules\\ts-node\\src\\index.ts:439:23)\n    at Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Object.require.extensions.<computed> [as .ts] (D:\\Proyectos\\ADNCeiba\\angular-base\\node_modules\\ts-node\\src\\index.ts:442:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "00a300cb-0044-0067-009e-000d004d0074.png",
        "timestamp": 1615987250128,
        "duration": 109
    },
    {
        "description": "deber??a mostrar p??gina de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 11244,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00990099-003c-005e-00e7-005e0025008a.png",
        "timestamp": 1615987412179,
        "duration": 1030
    },
    {
        "description": "deber??a mostrar mensaje error email obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 11244,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00bd00f6-00e1-008b-00bd-007500550082.png",
        "timestamp": 1615987413960,
        "duration": 1050
    },
    {
        "description": "deber??a mostrar mensaje error email no valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 11244,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0053006b-00db-003b-002c-0016007e00d0.png",
        "timestamp": 1615987415359,
        "duration": 1056
    },
    {
        "description": "muestra mensaje error password obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 11244,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00e100a4-00f8-00d5-00e0-002c00de005b.png",
        "timestamp": 1615987416725,
        "duration": 914
    },
    {
        "description": "redirecciona a la p??gina de home si login es valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 11244,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00d30013-0037-00c9-0050-004300b90018.png",
        "timestamp": 1615987417948,
        "duration": 1792
    },
    {
        "description": "Deber??a mostrar mensaje ISBN obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 11244,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "008000e6-00ec-0081-0062-00d700b000d3.png",
        "timestamp": 1615987420064,
        "duration": 138
    },
    {
        "description": "Muestra mensaje error Nombre obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 11244,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "007d0099-007c-0091-00f6-008500110067.png",
        "timestamp": 1615987420540,
        "duration": 179
    },
    {
        "description": "deber??a mostrar p??gina de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 2860,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00ab00da-00b9-0013-0084-00cb0095002e.png",
        "timestamp": 1615988225836,
        "duration": 1014
    },
    {
        "description": "deber??a mostrar mensaje error email obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 2860,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00f500e9-0049-00b1-00ea-0070009f00ff.png",
        "timestamp": 1615988227318,
        "duration": 875
    },
    {
        "description": "deber??a mostrar mensaje error email no valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 2860,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0060005b-004a-00f9-00bc-008e00e70095.png",
        "timestamp": 1615988228517,
        "duration": 962
    },
    {
        "description": "muestra mensaje error password obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 2860,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00430042-00b3-00cf-0096-0089003f00e5.png",
        "timestamp": 1615988229776,
        "duration": 897
    },
    {
        "description": "redirecciona a la p??gina de home si login es valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 2860,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00e600a7-006c-0086-00e7-0032008400cb.png",
        "timestamp": 1615988230962,
        "duration": 2003
    },
    {
        "description": "Deber??a mostrar mensaje ISBN obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 2860,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "003f00dd-0069-00d9-00fa-00c6002100d0.png",
        "timestamp": 1615988233289,
        "duration": 131
    },
    {
        "description": "Muestra mensaje error Nombre obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 2860,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0059000f-00ed-0021-0064-00e200ce0071.png",
        "timestamp": 1615988233744,
        "duration": 125
    },
    {
        "description": "deber??a mostrar p??gina de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 13108,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0044003d-0045-0037-00e1-00c0002700ec.png",
        "timestamp": 1615988317484,
        "duration": 964
    },
    {
        "description": "deber??a mostrar mensaje error email obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 13108,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00c30002-002d-00fe-00c5-00f800630078.png",
        "timestamp": 1615988318959,
        "duration": 944
    },
    {
        "description": "deber??a mostrar mensaje error email no valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 13108,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00040075-006d-00ac-0025-005e00db0014.png",
        "timestamp": 1615988320214,
        "duration": 1091
    },
    {
        "description": "muestra mensaje error password obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 13108,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00370013-00ea-00fe-0081-0029006a001d.png",
        "timestamp": 1615988321603,
        "duration": 902
    },
    {
        "description": "redirecciona a la p??gina de home si login es valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 13108,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "009c0082-005d-0088-001f-0072005100ed.png",
        "timestamp": 1615988322810,
        "duration": 1634
    },
    {
        "description": "Deber??a mostrar mensaje ISBN obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 13108,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00ee000a-00e7-009a-002b-00d700ef0041.png",
        "timestamp": 1615988324713,
        "duration": 132
    },
    {
        "description": "Muestra mensaje error Nombre obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 13108,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00920045-0055-00c3-00e5-0056007900fc.png",
        "timestamp": 1615988325116,
        "duration": 113
    },
    {
        "description": "deber??a mostrar p??gina de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 16772,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "003900e5-0092-0030-00d8-00eb00d40048.png",
        "timestamp": 1615988376720,
        "duration": 939
    },
    {
        "description": "deber??a mostrar mensaje error email obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 16772,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0083007a-008c-0066-008e-009d00ec0002.png",
        "timestamp": 1615988378148,
        "duration": 928
    },
    {
        "description": "deber??a mostrar mensaje error email no valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 16772,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "006b00a7-00c2-00a3-0015-00bd00a80006.png",
        "timestamp": 1615988379369,
        "duration": 960
    },
    {
        "description": "muestra mensaje error password obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 16772,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00b70015-00cc-002f-00ba-009c00e9007a.png",
        "timestamp": 1615988380628,
        "duration": 984
    },
    {
        "description": "redirecciona a la p??gina de home si login es valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 16772,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00450056-0028-000b-00cc-000100df008a.png",
        "timestamp": 1615988381927,
        "duration": 1948
    },
    {
        "description": "Deber??a mostrar mensaje ISBN obligatorio|workspace-project Prestamo",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 16772,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL."
        ],
        "trace": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL.\n    at Timeout._onTimeout (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4281:23)\n    at listOnTimeout (internal/timers.js:554:17)\n    at processTimers (internal/timers.js:497:7)"
        ],
        "browserLogs": [],
        "screenShotFile": "00e5008e-0028-00e2-0014-005d0053008e.png",
        "timestamp": 1615988384195,
        "duration": 30186
    },
    {
        "description": "Muestra mensaje error Nombre obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 16772,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00ae004d-0005-00d7-00da-00f600ab00ed.png",
        "timestamp": 1615988414692,
        "duration": 154
    },
    {
        "description": "deber??a mostrar p??gina de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 14976,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "001e0029-00a2-00c1-002b-00d000ed00ea.png",
        "timestamp": 1615988444204,
        "duration": 816
    },
    {
        "description": "deber??a mostrar mensaje error email obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 14976,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00460068-0069-0036-00c4-0062005800f2.png",
        "timestamp": 1615988445516,
        "duration": 965
    },
    {
        "description": "deber??a mostrar mensaje error email no valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 14976,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00ba00a6-00ca-00b9-00f1-007900950053.png",
        "timestamp": 1615988446843,
        "duration": 1015
    },
    {
        "description": "muestra mensaje error password obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 14976,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00730059-003b-0004-00e1-005c00720066.png",
        "timestamp": 1615988448153,
        "duration": 962
    },
    {
        "description": "redirecciona a la p??gina de home si login es valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 14976,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00f70099-00a7-0018-00c7-0023006b00aa.png",
        "timestamp": 1615988449455,
        "duration": 1901
    },
    {
        "description": "Deber??a mostrar mensaje ISBN obligatorio|workspace-project Prestamo",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 14976,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL."
        ],
        "trace": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL.\n    at Timeout._onTimeout (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4281:23)\n    at listOnTimeout (internal/timers.js:554:17)\n    at processTimers (internal/timers.js:497:7)"
        ],
        "browserLogs": [],
        "screenShotFile": "009400f4-00c3-0003-00b0-003e00cb0006.png",
        "timestamp": 1615988451636,
        "duration": 50231
    },
    {
        "description": "Muestra mensaje error Nombre obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 14976,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0070008b-006c-004f-000a-004400c400e7.png",
        "timestamp": 1615988502164,
        "duration": 154
    },
    {
        "description": "deber??a mostrar p??gina de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 10588,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "003700cc-0099-0003-00b7-00dd00bc0062.png",
        "timestamp": 1615988738311,
        "duration": 985
    },
    {
        "description": "deber??a mostrar mensaje error email obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 10588,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "004e0010-0005-0042-001f-00ef00af00d8.png",
        "timestamp": 1615988739812,
        "duration": 963
    },
    {
        "description": "deber??a mostrar mensaje error email no valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 10588,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "002c007a-0098-00d6-00e9-00bd00230017.png",
        "timestamp": 1615988741122,
        "duration": 1117
    },
    {
        "description": "muestra mensaje error password obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 10588,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00b90002-000f-004d-00ee-001d00e100d5.png",
        "timestamp": 1615988742584,
        "duration": 930
    },
    {
        "description": "redirecciona a la p??gina de home si login es valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 10588,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "004000f0-0095-009b-00f7-00e700bf00a0.png",
        "timestamp": 1615988743816,
        "duration": 2141
    },
    {
        "description": "Deber??a mostrar mensaje ISBN obligatorio|workspace-project Prestamo",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 10588,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL."
        ],
        "trace": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL.\n    at Timeout._onTimeout (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4281:23)\n    at listOnTimeout (internal/timers.js:554:17)\n    at processTimers (internal/timers.js:497:7)"
        ],
        "browserLogs": [],
        "screenShotFile": "002900f5-00cc-00dc-007b-008800730001.png",
        "timestamp": 1615988746231,
        "duration": 50183
    },
    {
        "description": "Muestra mensaje error Nombre obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 10588,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00680099-005a-0091-0088-00ba005c00a7.png",
        "timestamp": 1615988796721,
        "duration": 111
    },
    {
        "description": "deber??a mostrar p??gina de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 16816,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "004600cb-0083-00bd-00db-00a4009c00b7.png",
        "timestamp": 1615988886753,
        "duration": 3361
    },
    {
        "description": "deber??a mostrar mensaje error email obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 16816,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "005b00d6-0097-0057-006e-001a006b00fa.png",
        "timestamp": 1615988890615,
        "duration": 790
    },
    {
        "description": "deber??a mostrar mensaje error email no valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 16816,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "005100fa-0002-0027-002a-000500af008f.png",
        "timestamp": 1615988891718,
        "duration": 1044
    },
    {
        "description": "muestra mensaje error password obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 16816,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0073000d-0003-0079-0078-00330066009e.png",
        "timestamp": 1615988893106,
        "duration": 1062
    },
    {
        "description": "redirecciona a la p??gina de home si login es valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 16816,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "005e001e-00a7-005d-009f-000f004a00a5.png",
        "timestamp": 1615988894461,
        "duration": 2951
    },
    {
        "description": "deber??a mostrar p??gina de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 16192,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00a50028-0054-0056-0066-00af00b30060.png",
        "timestamp": 1615989614882,
        "duration": 873
    },
    {
        "description": "deber??a mostrar mensaje error email obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 16192,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00f60005-003f-00f7-00b8-00a100310050.png",
        "timestamp": 1615989616304,
        "duration": 1091
    },
    {
        "description": "deber??a mostrar mensaje error email no valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 16192,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "008f00bb-005b-00b8-00ca-008d00750025.png",
        "timestamp": 1615989617720,
        "duration": 1352
    },
    {
        "description": "muestra mensaje error password obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 16192,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00a700b7-0098-00bb-00cb-008f00f40077.png",
        "timestamp": 1615989619414,
        "duration": 1087
    },
    {
        "description": "redirecciona a la p??gina de home si login es valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 16192,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "000100c0-0049-005a-000a-005200fa0061.png",
        "timestamp": 1615989620786,
        "duration": 2400
    },
    {
        "description": "Deber??a mostrar mensaje ISBN obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 16192,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00dc0043-0009-00b2-0099-003c00c50040.png",
        "timestamp": 1615989623487,
        "duration": 140
    },
    {
        "description": "Muestra mensaje error Nombre obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 16192,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "008400fe-002a-00a3-00f5-001200aa000e.png",
        "timestamp": 1615989623920,
        "duration": 147
    },
    {
        "description": "deber??a mostrar p??gina de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 18268,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00460055-00a8-006a-00eb-009b006a00ca.png",
        "timestamp": 1615994061032,
        "duration": 960
    },
    {
        "description": "deber??a mostrar mensaje error email obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 18268,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "008e00ac-000f-0046-0039-0013007c00d8.png",
        "timestamp": 1615994062814,
        "duration": 822
    },
    {
        "description": "deber??a mostrar mensaje error email no valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 18268,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00a1008f-00e7-00c8-0022-007b00e4002a.png",
        "timestamp": 1615994063954,
        "duration": 996
    },
    {
        "description": "muestra mensaje error password obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 18268,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00a700e4-00c7-0064-004e-007c0012007f.png",
        "timestamp": 1615994065266,
        "duration": 934
    },
    {
        "description": "redirecciona a la p??gina de home si login es valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 18268,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "004700df-000a-00b4-0017-00d700070092.png",
        "timestamp": 1615994066482,
        "duration": 2521
    },
    {
        "description": "Deber??a mostrar mensaje ISBN obligatorio|workspace-project Prestamo",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 18268,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: No element found using locator: By(css selector, #isbnPrestamo)"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: By(css selector, #isbnPrestamo)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27\n    at ManagedPromise.invokeCallback_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)Error: \n    at ElementArrayFinder.applyAction_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as sendKeys] (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as sendKeys] (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at PrestamoPage.setIsbn (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\page\\prestamo\\prestamo.po.ts:10:29)\n    at UserContext.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\test\\prestamo.e2e-spec.ts:23:20)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"Deber??a mostrar mensaje ISBN obligatorio\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError: \n    at Suite.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\test\\prestamo.e2e-spec.ts:19:3)\n    at addSpecsToSuite (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\test\\prestamo.e2e-spec.ts:7:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Module.m._compile (D:\\Proyectos\\ADNCeiba\\angular-base\\node_modules\\ts-node\\src\\index.ts:439:23)\n    at Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Object.require.extensions.<computed> [as .ts] (D:\\Proyectos\\ADNCeiba\\angular-base\\node_modules\\ts-node\\src\\index.ts:442:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "0066001e-0033-00da-00d4-005300870020.png",
        "timestamp": 1615994069330,
        "duration": 47
    },
    {
        "description": "Muestra mensaje error Nombre obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 18268,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "007900a6-0094-0015-005e-00510005004d.png",
        "timestamp": 1615994069698,
        "duration": 105
    },
    {
        "description": "deber??a mostrar p??gina de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 4284,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "009600fa-0018-0059-00a0-00f700750005.png",
        "timestamp": 1615994644096,
        "duration": 816
    },
    {
        "description": "deber??a mostrar mensaje error email obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 4284,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "007d00a9-0036-00bb-0090-007500e2003c.png",
        "timestamp": 1615994645392,
        "duration": 903
    },
    {
        "description": "deber??a mostrar mensaje error email no valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 4284,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00f90091-0029-00be-0091-00ce00250031.png",
        "timestamp": 1615994646675,
        "duration": 1007
    },
    {
        "description": "muestra mensaje error password obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 4284,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00940053-005e-0057-00d8-00840030003d.png",
        "timestamp": 1615994648004,
        "duration": 931
    },
    {
        "description": "redirecciona a la p??gina de home si login es valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 4284,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "001200ea-0033-00f1-0067-007500da0019.png",
        "timestamp": 1615994649280,
        "duration": 1995
    },
    {
        "description": "est?? isbnprestamo presente en el dom|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 4284,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00d70064-0073-006e-003b-000900ed0044.png",
        "timestamp": 1615994651542,
        "duration": 29
    },
    {
        "description": "deber??a mostrar p??gina de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8848,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "007b003f-006e-0088-005e-000300eb0049.png",
        "timestamp": 1615994788985,
        "duration": 792
    },
    {
        "description": "deber??a mostrar mensaje error email obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8848,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "004f00b8-0040-00a1-00b6-0075004e0033.png",
        "timestamp": 1615994790275,
        "duration": 919
    },
    {
        "description": "deber??a mostrar mensaje error email no valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8848,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00d300b4-002f-008f-00cb-001e00880094.png",
        "timestamp": 1615994791581,
        "duration": 1040
    },
    {
        "description": "muestra mensaje error password obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8848,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "006d00ec-003c-00cd-0043-000600ce00ee.png",
        "timestamp": 1615994792928,
        "duration": 889
    },
    {
        "description": "redirecciona a la p??gina de home si login es valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8848,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00b90094-009d-0034-0078-000100770081.png",
        "timestamp": 1615994794108,
        "duration": 1746
    },
    {
        "description": "est?? isbnprestamo presente en el dom|workspace-project Prestamo",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 8848,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: Angular could not be found on the page http://localhost:4200/home. If this is not an Angular application, you may need to turn off waiting for Angular.\n                          Please see \n                          https://github.com/angular/protractor/blob/master/docs/timeouts.md#waiting-for-angular-on-page-load"
        ],
        "trace": [
            "Error: Angular could not be found on the page http://localhost:4200/home. If this is not an Angular application, you may need to turn off waiting for Angular.\n                          Please see \n                          https://github.com/angular/protractor/blob/master/docs/timeouts.md#waiting-for-angular-on-page-load\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:718:27\n    at ManagedPromise.invokeCallback_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: Run it(\"est?? isbnprestamo presente en el dom\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError: \n    at Suite.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\test\\prestamo.e2e-spec.ts:19:3)\n    at addSpecsToSuite (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\test\\prestamo.e2e-spec.ts:7:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Module.m._compile (D:\\Proyectos\\ADNCeiba\\angular-base\\node_modules\\ts-node\\src\\index.ts:439:23)\n    at Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Object.require.extensions.<computed> [as .ts] (D:\\Proyectos\\ADNCeiba\\angular-base\\node_modules\\ts-node\\src\\index.ts:442:12)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/home - Failed to load resource: the server responded with a status of 504 (Gateway Timeout)",
                "timestamp": 1615994796347,
                "type": ""
            }
        ],
        "screenShotFile": "000d00f4-0002-001d-0008-003500b5006d.png",
        "timestamp": 1615994796130,
        "duration": 10399
    },
    {
        "description": "deber??a mostrar p??gina de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 15820,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00db007e-0068-00ce-00a0-00f6002d00fa.png",
        "timestamp": 1615995817102,
        "duration": 1459
    },
    {
        "description": "deber??a mostrar mensaje error email obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 15820,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "006900bf-00a6-00e3-0081-00db00a700b1.png",
        "timestamp": 1615995819078,
        "duration": 996
    },
    {
        "description": "deber??a mostrar mensaje error email no valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 15820,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "006200bc-007b-0075-002f-004d002c0029.png",
        "timestamp": 1615995820447,
        "duration": 1085
    },
    {
        "description": "muestra mensaje error password obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 15820,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00c800de-00be-005a-00af-002c00e10059.png",
        "timestamp": 1615995821855,
        "duration": 916
    },
    {
        "description": "redirecciona a la p??gina de home si login es valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 15820,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "002c005e-0014-0005-001f-009800b8006b.png",
        "timestamp": 1615995823102,
        "duration": 2013
    },
    {
        "description": "est?? isbnprestamo presente en el dom|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 15820,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00980048-006d-00af-00ba-00980006003c.png",
        "timestamp": 1615995825376,
        "duration": 666
    },
    {
        "description": "deber??a mostrar p??gina de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 7792,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00d00099-0031-007f-0020-000300170096.png",
        "timestamp": 1615996329909,
        "duration": 954
    },
    {
        "description": "deber??a mostrar mensaje error email obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 7792,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "004000dd-007d-00a1-0033-00b00036001f.png",
        "timestamp": 1615996331336,
        "duration": 918
    },
    {
        "description": "deber??a mostrar mensaje error email no valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 7792,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "002a0031-0070-003b-0034-00e2009e0079.png",
        "timestamp": 1615996332564,
        "duration": 975
    },
    {
        "description": "muestra mensaje error password obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 7792,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00a0007f-003c-00d7-004c-00e200f70053.png",
        "timestamp": 1615996333847,
        "duration": 895
    },
    {
        "description": "redirecciona a la p??gina de home si login es valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 7792,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "008f00a8-0030-00b1-001b-00c50027003d.png",
        "timestamp": 1615996335044,
        "duration": 2089
    },
    {
        "description": "Muestra mensaje ISBN obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 7792,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00ec00ed-008b-00c9-00ec-00bb004000fe.png",
        "timestamp": 1615996337441,
        "duration": 796
    },
    {
        "description": "Muestra mensaje error Nombre obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 7792,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "007700e6-00fc-004b-0051-00b300f000a0.png",
        "timestamp": 1615996338527,
        "duration": 832
    },
    {
        "description": "deber??a mostrar p??gina de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 1176,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00bf0032-0066-00a7-0057-0011004100d5.png",
        "timestamp": 1615996433619,
        "duration": 810
    },
    {
        "description": "deber??a mostrar mensaje error email obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 1176,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00430062-0093-0044-0051-00ec0036008a.png",
        "timestamp": 1615996434903,
        "duration": 883
    },
    {
        "description": "deber??a mostrar mensaje error email no valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 1176,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "000900a5-0004-0017-0083-00d0009e00c6.png",
        "timestamp": 1615996436084,
        "duration": 953
    },
    {
        "description": "muestra mensaje error password obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 1176,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00f50050-008d-000b-0014-00b0009c007b.png",
        "timestamp": 1615996437336,
        "duration": 929
    },
    {
        "description": "redirecciona a la p??gina de home si login es valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 1176,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "009500e1-0022-0005-007d-006d00ca0037.png",
        "timestamp": 1615996438547,
        "duration": 1821
    },
    {
        "description": "Muestra mensaje ISBN obligatorio|workspace-project Prestamo",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 1176,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL."
        ],
        "trace": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL.\n    at Timeout._onTimeout (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4281:23)\n    at listOnTimeout (internal/timers.js:554:17)\n    at processTimers (internal/timers.js:497:7)"
        ],
        "browserLogs": [],
        "screenShotFile": "00540050-00ac-0015-00ac-006400510082.png",
        "timestamp": 1615996440660,
        "duration": 50824
    },
    {
        "description": "Muestra mensaje error Nombre obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 1176,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "000a0014-00f5-00cb-0073-003100b900ab.png",
        "timestamp": 1615996491808,
        "duration": 1078
    },
    {
        "description": "deber??a mostrar p??gina de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 5396,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00720095-0049-0028-00f7-003800bc0021.png",
        "timestamp": 1615997216346,
        "duration": 5349
    },
    {
        "description": "deber??a mostrar mensaje error email obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 5396,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00ab003b-002a-0057-007f-00ea0054003c.png",
        "timestamp": 1615997222176,
        "duration": 964
    },
    {
        "description": "deber??a mostrar mensaje error email no valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 5396,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00ff004e-0005-000b-001b-001e00bb00a3.png",
        "timestamp": 1615997223453,
        "duration": 1008
    },
    {
        "description": "muestra mensaje error password obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 5396,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00b400fd-00fe-00b5-000b-00060029007c.png",
        "timestamp": 1615997224758,
        "duration": 979
    },
    {
        "description": "redirecciona a la p??gina de home si login es valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 5396,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "001d0012-0086-00a9-00d2-00cd002d0046.png",
        "timestamp": 1615997226064,
        "duration": 9361
    },
    {
        "description": "Muestra mensaje ISBN obligatorio|workspace-project Prestamo",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 5396,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL."
        ],
        "trace": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL.\n    at Timeout._onTimeout (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4281:23)\n    at listOnTimeout (internal/timers.js:554:17)\n    at processTimers (internal/timers.js:497:7)"
        ],
        "browserLogs": [],
        "screenShotFile": "00340063-00e1-00cd-00d2-004000e50059.png",
        "timestamp": 1615997235694,
        "duration": 51133
    },
    {
        "description": "Muestra mensaje error Nombre obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 5396,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00ed00a9-00cd-001c-0092-008a00b200de.png",
        "timestamp": 1615997287148,
        "duration": 718
    },
    {
        "description": "deber??a mostrar p??gina de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 5044,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00cb00f5-00c5-0066-00c7-0015008000da.png",
        "timestamp": 1615999164962,
        "duration": 1968
    },
    {
        "description": "deber??a mostrar mensaje error email obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 5044,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "000e004f-00b1-0065-0032-00dd0098006b.png",
        "timestamp": 1615999167438,
        "duration": 995
    },
    {
        "description": "deber??a mostrar mensaje error email no valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 5044,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00b400e0-009c-0082-00d7-0028004c00f6.png",
        "timestamp": 1615999168787,
        "duration": 1081
    },
    {
        "description": "muestra mensaje error password obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 5044,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00130026-00e0-0029-002f-003300d40077.png",
        "timestamp": 1615999170204,
        "duration": 975
    },
    {
        "description": "redirecciona a la p??gina de home si login es valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 5044,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00470077-0055-0031-001e-00aa0006009a.png",
        "timestamp": 1615999171483,
        "duration": 2151
    },
    {
        "description": "Muestra mensaje ISBN obligatorio|workspace-project Prestamo",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 5044,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Expected [  ] to equal 'ISBN es obligatorio'."
        ],
        "trace": [
            "Error: Failed expectation\n    at D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\test\\prestamo.e2e-spec.ts:31:23\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)"
        ],
        "browserLogs": [],
        "screenShotFile": "0035005b-0020-001b-0065-00ff007f00d2.png",
        "timestamp": 1615999173909,
        "duration": 999
    },
    {
        "description": "Muestra mensaje error Nombre obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 5044,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00760087-0072-00f0-00ae-000a00ed0007.png",
        "timestamp": 1615999175210,
        "duration": 841
    },
    {
        "description": "deber??a mostrar p??gina de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 17652,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "000a00a9-00ce-00d1-006c-0016006400a1.png",
        "timestamp": 1615999286004,
        "duration": 2268
    },
    {
        "description": "deber??a mostrar mensaje error email obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 17652,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0092003c-0009-000f-004a-0024006200ac.png",
        "timestamp": 1615999288771,
        "duration": 896
    },
    {
        "description": "deber??a mostrar mensaje error email no valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 17652,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "004b0000-0043-00ea-0092-00160033006c.png",
        "timestamp": 1615999289999,
        "duration": 962
    },
    {
        "description": "muestra mensaje error password obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 17652,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00e80045-002d-0064-00ab-007e00f90070.png",
        "timestamp": 1615999291265,
        "duration": 816
    },
    {
        "description": "redirecciona a la p??gina de home si login es valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 17652,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00490088-00b0-002e-00bd-008b00400058.png",
        "timestamp": 1615999292387,
        "duration": 1929
    },
    {
        "description": "est?? isbnprestamo presente en el dom|workspace-project Prestamo",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 17652,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Expected false to be true."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\test\\prestamo.e2e-spec.ts:21:70)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7"
        ],
        "browserLogs": [],
        "screenShotFile": "003800fe-00c1-0096-00c8-005900a300fc.png",
        "timestamp": 1615999294620,
        "duration": 602
    },
    {
        "description": "deber??a mostrar p??gina de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 5248,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00150064-0050-0051-00c8-009a0082001a.png",
        "timestamp": 1615999355045,
        "duration": 5157
    },
    {
        "description": "deber??a mostrar mensaje error email obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 5248,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00280048-0028-00d9-00e7-002800d20049.png",
        "timestamp": 1615999360707,
        "duration": 800
    },
    {
        "description": "deber??a mostrar mensaje error email no valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 5248,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "009d006c-00d6-0083-00cb-006c00570026.png",
        "timestamp": 1615999361831,
        "duration": 1013
    },
    {
        "description": "muestra mensaje error password obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 5248,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00ab0006-00ad-00f9-006f-008e005d00b3.png",
        "timestamp": 1615999363174,
        "duration": 974
    },
    {
        "description": "redirecciona a la p??gina de home si login es valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 5248,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00010078-0058-005a-0063-00120065002b.png",
        "timestamp": 1615999364493,
        "duration": 2207
    },
    {
        "description": "est?? isbnprestamo presente en el dom|workspace-project Prestamo",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 5248,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL.",
            "Expected false to be true."
        ],
        "trace": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL.\n    at Timeout._onTimeout (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4281:23)\n    at listOnTimeout (internal/timers.js:554:17)\n    at processTimers (internal/timers.js:497:7)",
            "Error: Failed expectation\n    at UserContext.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\test\\prestamo.e2e-spec.ts:22:70)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7"
        ],
        "browserLogs": [],
        "screenShotFile": "00a4002f-0019-009f-007d-003a00a000a7.png",
        "timestamp": 1615999367050,
        "duration": 50534
    },
    {
        "description": "deber??a mostrar p??gina de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 14800,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "008b0026-00e9-00fd-00a4-009800d40012.png",
        "timestamp": 1615999542301,
        "duration": 2996
    },
    {
        "description": "deber??a mostrar mensaje error email obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 14800,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0078007a-00b9-0053-0035-008000690087.png",
        "timestamp": 1615999545805,
        "duration": 861
    },
    {
        "description": "deber??a mostrar mensaje error email no valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 14800,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "002500b1-0022-00ac-007d-0003007f00f4.png",
        "timestamp": 1615999546971,
        "duration": 1094
    },
    {
        "description": "muestra mensaje error password obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 14800,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "001c00f9-0049-00ac-00e1-007600d10060.png",
        "timestamp": 1615999548379,
        "duration": 915
    },
    {
        "description": "redirecciona a la p??gina de home si login es valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 14800,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00550046-005b-004d-00c6-009f00750086.png",
        "timestamp": 1615999549601,
        "duration": 4023
    },
    {
        "description": "est?? isbnprestamo presente en el dom|workspace-project Prestamo",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 14800,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL."
        ],
        "trace": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL.\n    at Timeout._onTimeout (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4281:23)\n    at listOnTimeout (internal/timers.js:554:17)\n    at processTimers (internal/timers.js:497:7)"
        ],
        "browserLogs": [],
        "screenShotFile": "0065008e-0096-00a8-001e-007e008d00d4.png",
        "timestamp": 1615999553923,
        "duration": 50840
    },
    {
        "description": "deber??a mostrar p??gina de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 17072,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00010074-0020-0073-007a-0065008500f7.png",
        "timestamp": 1615999653315,
        "duration": 5030
    },
    {
        "description": "deber??a mostrar mensaje error email obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 17072,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "006800f2-00cc-006e-00c4-000300a1006f.png",
        "timestamp": 1615999658871,
        "duration": 934
    },
    {
        "description": "deber??a mostrar mensaje error email no valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 17072,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00650084-009a-0055-0057-00180090009a.png",
        "timestamp": 1615999660135,
        "duration": 986
    },
    {
        "description": "muestra mensaje error password obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 17072,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "009400f4-007a-00ae-0069-008400e100ec.png",
        "timestamp": 1615999661438,
        "duration": 901
    },
    {
        "description": "redirecciona a la p??gina de home si login es valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 17072,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "008c004d-000b-00e4-0071-008e0096002e.png",
        "timestamp": 1615999662628,
        "duration": 2179
    },
    {
        "description": "est?? isbnprestamo presente en el dom|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 17072,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00bb00a8-00d4-002e-0046-005400500057.png",
        "timestamp": 1615999665114,
        "duration": 604
    },
    {
        "description": "deber??a mostrar p??gina de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 20360,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "007e0080-0097-0031-000d-0087009a0001.png",
        "timestamp": 1616000225037,
        "duration": 3870
    },
    {
        "description": "deber??a mostrar mensaje error email obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 20360,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "009a00b2-009b-00cb-00ee-00e3003b005f.png",
        "timestamp": 1616000229571,
        "duration": 938
    },
    {
        "description": "deber??a mostrar mensaje error email no valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 20360,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00f90059-00cf-00eb-000f-00060040007a.png",
        "timestamp": 1616000230814,
        "duration": 984
    },
    {
        "description": "muestra mensaje error password obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 20360,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0041005d-0072-00cc-0076-00210082009e.png",
        "timestamp": 1616000232132,
        "duration": 943
    },
    {
        "description": "redirecciona a la p??gina de home si login es valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 20360,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00950058-007d-00ad-0040-000200ef00f1.png",
        "timestamp": 1616000233413,
        "duration": 2527
    },
    {
        "description": "Muestra mensaje ISBN obligatorio|workspace-project Prestamo",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 20360,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Expected ElementFinder({ browser_: ProtractorBrowser({ controlFlow: Function, schedule: Function, setFileDetector: Function, getExecutor: Function, getSession: Function, getCapabilities: Function, quit: Function, actions: Function, touchActions: Function, executeScript: Function, executeAsyncScript: Function, call: Function, wait: Function, sleep: Function, getWindowHandle: Function, getAllWindowHandles: Function, getPageSource: Function, close: Function, getCurrentUrl: Function, getTitle: Function, findElementInternal_: Function, findElementsInternal_: Function, takeScreenshot: Function, manage: Function, switchTo: Function, driver: Driver({ flow_: ControlFlow::3737\n| TaskQueue::3197\n| | (blocked) Task::3196<Run it(\"Muestra mensaje ISBN obligatorio\") in control flow>\n| | Task::3199<then>\n| (active) TaskQueue::3736\n| | Task::3735<then>, session_: ManagedPromise::4 {[[PromiseStatus]]: \"fulfilled\"}, executor_: Executor({ w3c: false, customCommands_: Map( [ 'launchApp', Object({ method: 'POST', path: '/session/:sessionId/chromium/launch_app' }) ], [ 'getNetworkConditions', Object({ method: 'GET', path: '/session/:sessionId/chromium/network_conditions' }) ], [ 'setNetworkConditions', Object({ method: 'POST', path: '/session/:sessionId/chromium/network_conditions' }) ], [ 'getNetworkConnection', Object({ method: 'GET', path: '/session/:sessionId/network_connection' }) ], [ 'setNetworkConnection', Object({ method: 'POST', path: '/session/:sessionId/network_connection' }) ], [ 'toggleAirplaneMode', Object({ method: 'POST', path: '/session/:sessionId/appium/device/toggle_airplane_mode' }) ], [ 'toggleWiFi', Object({ method: 'POST', path: '/session/:sessionId/appium/device/toggle_wifi' }) ], [ 'toggleData', Object({ method: 'POST', path: '/session/:sessionId/appium/device/toggle_data' }) ], [ 'toggleLocationServices', Object({ method: 'POST', path: '/session/:sessionId/appium/device/toggle_location_services' }) ], [ 'getGeolocation', Object({ method: 'GET', path: '/session/:sessionId/location' }) ], [ 'setGeolocation', Object({ method: 'POST', path: '/session/:sessionId/location' }) ], [ 'getCurrentDeviceActivity', Object({ method: 'GET', path: '/session/:sessionId/appium/device/current_activity' }) ], [ 'startDeviceActivity', Object({ method: 'POST', path: '/session/:sessionId/appium/device/start_activity' }) ], [ 'getAppiumSettings', Object({ method: 'GET', path: '/session/:sessionId/appium/settings' }) ], [ 'setAppiumSettings', Object({ method: 'POST', path: '/session/:sessionId/appium/settings' }) ], [ 'getCurrentContext', Object({ method: 'GET', path: '/session/:sessionId/context' }) ], [ 'selectContext', Object({ method: 'POST', path: '/session/:sessionId/context' }) ], [ 'getScreenOrientation', Object({ method: 'GET', path: '/session/:sessionId/orientation' }) ], [ 'setScreenOrientation', Object({ method: 'POST', path: '/session/:sessionId/orientation' }) ], [ 'isDeviceLocked', Object({ method: 'POST', path: '/session/:sessionId/appium/device/is_locked' }) ], [ 'lockDevice', Object({ method: 'POST', path: '/session/:sessionId/appium/device/lock' }) ], [ 'unlockDevice', Object({ method: 'POST', path: '/session/:sessionId/appium/device/unlock' }) ], [ 'installApp', Object({ method: 'POST', path: '/session/:sessionId/appium/device/install_app' }) ], [ 'isAppInstalled', Object({ method: 'POST', path: '/session/:sessionId/appium/device/app_installed' }) ], [ 'removeApp', Object({ method: 'POST', path: '/session/:sessionId/appium/device/remove_app' }) ], [ 'pullFileFromDevice', Object({ method: 'POST', path: '/session/:sessionId/appium/device/pull_file' }) ], [ 'pullFolderFromDevice', Object({ method: 'POST', path: '/session/:sessionId/appium/device/pull_folder' }) ], [ 'pushFileToDevice', Object({ method: 'POST', path: '/session/:sessionId/appium/device/push_file' }) ], [ 'listContexts', Object({ method: 'GET', path: '/session/:sessionId/contexts' }) ], [ 'uploadFile', Object({ method: 'POST', path: '/session/:sessionId/file' }) ], [ 'switchToParentFrame', Object({ method: 'POST', path: '/session/:sessionId/frame/parent' }) ], [ 'fullscreen', Object({ method: 'POST', path: '/session/:sessionId/window/fullscreen' }) ], [ 'sendAppToBackground', Object({ method: 'POST', path: '/session/:sessionId/appium/app/background' }) ], [ 'closeApp', Object({ method: 'POST', path: '/session/:sessionId/appium/app/close' }) ], [ 'getAppStrings', Object({ method: 'POST', path: '/session/:sessionId/appium/app/strings' }) ], [ 'launchSession', Object({ method: 'POST', path: '/session/:sessionId/appium/app/launch' }) ], [ 'resetApp', Object({ method: 'POST', path: '/session/:sessionId/appium/app/reset' }) ], [ 'hideSoftKeyboard', Object({ method: 'POST', path: '/session/:sessionId/appium/device/hide_keyboard' }) ], [ 'getDeviceTime', Object({ method: 'GET', path: '/session/:sessionId/appium/device/system_time' }) ], [ 'openDeviceNotifications', Object({ method: 'POST', path: '/session/:sessionId/appium/device/open_notifications' }) ], [ 'rotationGesture', Object({ method: 'POST', path: '/session/:sessionId/appium/device/rotate' }) ], [ 'shakeDevice', Object({ method: 'POST', path: '/session/:sessionId/appium/device/shake' }) ], [ 'sendChromiumCommand', Object({ method: 'POST', path: '/session/:sessionId/chromium/send_command' }) ], [ 'sendChromiumCommandAndGetResult', Object({ method: 'POST', path: '/session/:sessionId/chromium/send_command_and_get_result' }) ] ), log_: Logger({ name_: 'webdriver.http.Executor', level_: null, parent_: Logger({ name_: 'webdriver.http', level_: null, parent_: Logger({ name_: 'webdriver', level_: null, parent_: Logger({ name_: '', level_: OFF, parent_: null, handlers_: null }), handlers_: null }), handlers_: null }), handlers_: null }) }), fileDetector_: null, onQuit_: undefined, getNetworkConnection: Function, setNetworkConnection: Function, toggleAirplaneMode: Function, toggleWiFi: Function, toggleData: Function, toggleLocationServices: Function, getGeolocation: Function, setGeolocation: Function, getCurrentDeviceActivity: Function, startDeviceActivity: Function, getAppiumSettings: Function, setAppiumSettings: Function, getCurrentContext: Function, selectContext: Function, getScreenOrientation: Function, setScreenOrientation: Function, isDeviceLocked: Function, lockDevice: Function, unlockDevice: Function, installApp: Function, isAppInstalled: Function, removeApp: Function, pullFileFromDevice: Function, pullFolderFromDevice: Function, pushFileToDevice: Function, listContexts: Function, uploadFile: Function, switchToParentFrame: Function, fullscreen: Function, sendAppToBackground: Function, closeApp: Function, getAppStrings: Function, launchSession: Function, resetApp: Function, hideSoftKeyboard: Function, getDeviceTime: Function, openDeviceNotifications: Function, rotationGesture: Function, shakeDevice: Function, sendChromiumCommand: Function, sendChromiumCommandAndGetResult: Function }), element: Function, $: Function, $: Function, baseUrl: 'http://localhost:4200/', getPageTimeout: 10000, params: Object({  }), resetUrl: 'data:text/html,<html></html>', ready: ManagedPromise::17 {[[PromiseStatus]]: \"fulfilled\"}, trackOutstandingTimeouts_: true, mockModules_: [ Object({ name: 'protractorBaseModule_', script: Function, args: [ true ] }) ], ExpectedConditions: ProtractorExpectedConditions({ browser: <circular reference: Object> }), plugins_: Plugins({ setup: Function, onPrepare: Function, teardown: Function, postResults: Function, postTest: Function, onPageLoad: Function, onPageStable: Function, waitForPromise: Function, waitForCondition: Function, pluginObjs: [  ], assertions: Object({  }), resultsReported: false }), allScriptsTimeout: 11000, getProcessedConfig: Function, forkNewDriverInstance: Function, restart: Function, restartSync: Function, internalRootEl: '', internalIgnoreSynchronization: false }), then: null, parentElementArrayFinder: ElementArrayFinder({ browser_: ProtractorBrowser({ controlFlow: Function, schedule: Function, setFileDetector: Function, getExecutor: Function, getSession: Function, getCapabilities: Function, quit: Function, actions: Function, touchActions: Function, executeScript: Function, executeAsyncScript: Function, call: Function, wait: Function, sleep: Function, getWindowHandle: Function, getAllWindowHandles: Function, getPageSource: Function, close: Function, getCurrentUrl: Function, getTitle: Function, findElementInternal_: Function, findElementsInternal_: Function, takeScreenshot: Function, manage: Function, switchTo: Function, driver: Driver({ flow_: ControlFlow::3737\n| TaskQueue::3197\n| | (blocked) Task::3196<Run it(\"Muestra mensaje ISBN obligatorio\") in control flow>\n| | Task::3199<then>\n| (active) TaskQueue::3736\n| | Task::3735<then>, session_: ManagedPromise::4 {[[PromiseStatus]]: \"fulfilled\"}, executor_: Executor({ w3c: false, customCommands_: Map( [ 'launchApp', Object({ method: 'POST', path: '/session/:sessionId/chromium/launch_app' }) ], [ 'getNetworkConditions', Object({ method: 'GET', path: '/session/:sessionId/chromium/network_conditions' }) ], [ 'setNetworkConditions', Object({ method: 'POST', path: '/session/:sessionId/chromium/network_conditions' }) ], [ 'getNetworkConnection', Object({ method: 'GET', path: '/session/:sessionId/network_connection' }) ], [ 'setNetworkConnection', Object({ method: 'POST', path: '/session/:sessionId/network_connection' }) ], [ 'toggleAirplaneMode', Object({ method: 'POST', path: '/session/:sessionId/appium/device/toggle_airplane_mode' }) ], [ 'toggleWiFi', Object({ method: 'POST', path: '/session/:sessionId/appium/device/toggle_wifi' }) ], [ 'toggleData', Object({ method: 'POST', path: '/session/:sessionId/appium/device/toggle_data' }) ], [ 'toggleLocationServices', Object({ method: 'POST', path: '/session/:sessionId/appium/device/toggle_location_services' }) ], [ 'getGeolocation', Object({ method: 'GET', path: '/session/:sessionId/location' }) ], [ 'setGeolocation', Object({ method: 'POST', path: '/session/:sessionId/location' }) ], [ 'getCurrentDeviceActivity', Object({ method: 'GET', path: '/session/:sessionId/appium/device/current_activity' }) ], [ 'startDeviceActivity', Object({ method: 'POST', path: '/session/:sessionId/appium/device/start_activity' }) ], [ 'getAppiumSettings', Object({ method: 'GET', path: '/session/:sessionId/appium/settings' }) ], [ 'setAppiumSettings', Object({ method: 'POST', path: '/session/:sessionId/appium/settings' }) ], [ 'getCurrentContext', Object({ method: 'GET', path: '/session/:sessionId/context' }) ], [ 'selectContext', Object({ method: 'POST', path: '/session/:sessionId/context' }) ], [ 'getScreenOrientation', Object({ method: 'GET', path: '/session/:sessionId/orientation' }) ], [ 'setScreenOrientation', Object({ method: 'POST', path: '/session/:sessionId/orientation' }) ], [ 'isDeviceLocked', Object({ method: 'POST', path: '/session/:sessionId/appium/device/is_locked' }) ], [ 'lockDevice', Object({ method: 'POST', path: '/session/:sessionId/appium/device/lock' }) ], [ 'unlockDevice', Object({ method: 'POST', path: '/session/:sessionId/appium/device/unlock' }) ], [ 'installApp', Object({ method: 'POST', path: '/session/:sessionId/appium/device/install_app' }) ], [ 'isAppInstalled', Object({ method: 'POST', path: '/session/:sessionId/appium/device/app_installed' }) ], [ 'removeApp', Object({ method: 'POST', path: '/session/:sessionId/appium/device/remove_app' }) ], [ 'pullFileFromDevice', Object({ method: 'POST', path: '/session/:sessionId/appium/device/pull_file' }) ], [ 'pullFolderFromDevice', Object({ method: 'POST', path: '/session/:sessionId/appium/device/pull_folder' }) ], [ 'pushFileToDevice', Object({ method: 'POST', path: '/session/:sessionId/appium/device/push_file' }) ], [ 'listContexts', Object({ method: 'GET', path: '/session/:sessionId/contexts' }) ], [ 'uploadFile', Object({ method: 'POST', path: '/session/:sessionId/file' }) ], [ 'switchToParentFrame', Object({ method: 'POST', path: '/session/:sessionId/frame/parent' }) ], [ 'fullscreen', Object({ method: 'POST', path: '/session/:sessionId/window/fullscreen' }) ], [ 'sendAppToBackground', Object({ method: 'POST', path: '/session/:sessionId/appium/app/background' }) ], [ 'closeApp', Object({ method: 'POST', path: '/session/:sessionId/appium/app/close' }) ], [ 'getAppStrings', Object({ method: 'POST', path: '/session/:sessionId/appium/app/strings' }) ], [ 'launchSession', Object({ method: 'POST', path: '/session/:sessionId/appium/app/launch' }) ], [ 'resetApp', Object({ method: 'POST', path: '/session/:sessionId/appium/app/reset' }) ], [ 'hideSoftKeyboard', Object({ method: 'POST', path: '/session/:sessionId/appium/device/hide_keyboard' }) ], [ 'getDeviceTime', Object({ method: 'GET', path: '/session/:sessionId/appium/device/system_time' }) ], [ 'openDeviceNotifications', Object({ method: 'POST', path: '/session/:sessionId/appium/device/open_notifications' }) ], [ 'rotationGesture', Object({ method: 'POST', path: '/session/:sessionId/appium/device/rotate' }) ], [ 'shakeDevice', Object({ method: 'POST', path: '/session/:sessionId/appium/device/shake' }) ], [ 'sendChromiumCommand', Object({ method: 'POST', path: '/session/:sessionId/chromium/send_command' }) ], [ 'sendChromiumCommandAndGetResult', Object({ method: 'POST', path: '/session/:sessionId/chromium/send_command_and_get_result' }) ] ), log_: Logger({ name_: 'webdriver.http.Executor', level_: null, parent_: Logger({ name_: 'webdriver.http', level_: null, parent_: Logger({ name_: 'webdriver', level_: null, parent_: Logger({ name_: '', level_: OFF, parent_: null, handlers_: null }), handlers_: null }), handlers_: null }), handlers_: null }) }), fileDetector_: null, onQuit_: undefined, getNetworkConnection: Function, setNetworkConnection: Function, toggleAirplaneMode: Function, toggleWiFi: Function, toggleData: Function, toggleLocationServices: Function, getGeolocation: Function, setGeolocation: Function, getCurrentDeviceActivity: Function, startDeviceActivity: Function, getAppiumSettings: Function, setAppiumSettings: Function, getCurrentContext: Function, selectContext: Function, getScreenOrientation: Function, setScreenOrientation: Function, isDeviceLocked: Function, lockDevice: Function, unlockDevice: Function, installApp: Function, isAppInstalled: Function, removeApp: Function, pullFileFromDevice: Function, pullFolderFromDevice: Function, pushFileToDevice: Function, listContexts: Function, uploadFile: Function, switchToParentFrame: Function, fullscreen: Function, sendAppToBackground: Function, closeApp: Function, getAppStrings: Function, launchSession: Function, resetApp: Function, hideSoftKeyboard: Function, getDeviceTime: Function, openDeviceNotifications: Function, rotationGesture: Function, shakeDevice: Function, sendChromiumCommand: Function, sendChromiumCommandAndGetResult: Function }), element: Function, $: Function, $: Function, baseUrl: 'http://localhost:4200/', getPageTimeout: 10000, params: Object({  }), resetUrl: 'data:text/html,<html></html>', ready: ManagedPromise::17 {[[PromiseStatus]]: \"fulfilled\"}, trackOutstandingTimeouts_: true, mockModules_: [ Object({ name: 'protractorBaseModule_', script: Function, args: [ true ] }) ], ExpectedConditions: ProtractorExpectedConditions({ browser: <circular reference: Object> }), plugins_: Plugins({ setup: Function, onPrepare: Function, teardown: Function, postResults: Function, postTest: Function, onPageLoad: Function, onPageStable: Function, waitForPromise: Function, waitForCondition: Function, pluginObjs: [  ], assertions: Object({  }), resultsReported: false }), allScriptsTimeout: 11000, getProcessedConfig: Function, forkNewDriverInstance: Function, restart: Function, restartSync: Function, internalRootEl: '', internalIgnoreSynchronization: false }), getWebElements: Function, locator_: By(css selector, .invalid-feedback), actionResults_: null, click: Function, sendKeys: Function, getTagName: Function, getCssValue: Function, getAttribute: Function, getText: Function, getSize: Function, getLocation: Function, isEnabled: Function, isSelected: Function, submit: Function, clear: Function, isDisplayed: Function, getId: Function, takeScreenshot: Function }), elementArrayFinder_: ElementArrayFinder({ browser_: ProtractorBrowser({ controlFlow: Function, schedule: Function, setFileDetector: Function, getExecutor: Function, getSession: Function, getCapabilities: Function, quit: Function, actions: Function, touchActions: Function, executeScript: Function, executeAsyncScript: Function, call: Function, wait: Function, sleep: Function, getWindowHandle: Function, getAllWindowHandles: Function, getPageSource: Function, close: Function, getCurrentUrl: Function, getTitle: Function, findElementInternal_: Function, findElementsInternal_: Function, takeScreenshot: Function, manage: Function, switchTo: Function, driver: Driver({ flow_: ControlFlow::3737\n| TaskQueue::3197\n| | (blocked) Task::3196<Run it(\"Muestra mensaje ISBN obligatorio\") in control flow>\n| | Task::3199<then>\n| (active) TaskQueue::3736\n| | Task::3735<then>, session_: ManagedPromise::4 {[[PromiseStatus]]: \"fulfilled\"}, executor_: Executor({ w3c: false, customCommands_: Map( [ 'launchApp', Object({ method: 'POST', path: '/session/:sessionId/chromium/launch_app' }) ], [ 'getNetworkConditions', Object({ method: 'GET', path: '/session/:sessionId/chromium/network_conditions' }) ], [ 'setNetworkConditions', Object({ method: 'POST', path: '/session/:sessionId/chromium/network_conditions' }) ], [ 'getNetworkConnection', Object({ method: 'GET', path: '/session/:sessionId/network_connection' }) ], [ 'setNetworkConnection', Object({ method: 'POST', path: '/session/:sessionId/network_connection' }) ], [ 'toggleAirplaneMode', Object({ method: 'POST', path: '/session/:sessionId/appium/device/toggle_airplane_mode' }) ], [ 'toggleWiFi', Object({ method: 'POST', path: '/session/:sessionId/appium/device/toggle_wifi' }) ], [ 'toggleData', Object({ method: 'POST', path: '/session/:sessionId/appium/device/toggle_data' }) ], [ 'toggleLocationServices', Object({ method: 'POST', path: '/session/:sessionId/appium/device/toggle_location_services' }) ], [ 'getGeolocation', Object({ method: 'GET', path: '/session/:sessionId/location' }) ], [ 'setGeolocation', Object({ method: 'POST', path: '/session/:sessionId/location' }) ], [ 'getCurrentDeviceActivity', Object({ method: 'GET', path: '/session/:sessionId/appium/device/current_activity' }) ], [ 'startDeviceActivity', Object({ method: 'POST', path: '/session/:sessionId/appium/device/start_activity' }) ], [ 'getAppiumSettings', Object({ method: 'GET', path: '/session/:sessionId/appium/settings' }) ], [ 'setAppiumSettings', Object({ method: 'POST', path: '/session/:sessionId/appium/settings' }) ], [ 'getCurrentContext', Object({ method: 'GET', path: '/session/:sessionId/context' }) ], [ 'selectContext', Object({ method: 'POST', path: '/session/:sessionId/context' }) ], [ 'getScreenOrientation', Object({ method: 'GET', path: '/session/:sessionId/orientation' }) ], [ 'setScreenOrientation', Object({ method: 'POST', path: '/session/:sessionId/orientation' }) ], [ 'isDeviceLocked', Object({ method: 'POST', path: '/session/:sessionId/appium/device/is_locked' }) ], [ 'lockDevice', Object({ method: 'POST', path: '/session/:sessionId/appium/device/lock' }) ], [ 'unlockDevice', Object({ method: 'POST', path: '/session/:sessionId/appium/device/unlock' }) ], [ 'installApp', Object({ method: 'POST', path: '/session/:sessionId/appium/device/install_app' }) ], [ 'isAppInstalled', Object({ method: 'POST', path: '/session/:sessionId/appium/device/app_installed' }) ], [ 'removeApp', Object({ method: 'POST', path: '/session/:sessionId/appium/device/remove_app' }) ], [ 'pullFileFromDevice', Object({ method: 'POST', path: '/session/:sessionId/appium/device/pull_file' }) ], [ 'pullFolderFromDevice', Object({ method: 'POST', path: '/session/:sessionId/appium/device/pull_folder' }) ], [ 'pushFileToDevice', Object({ method: 'POST', path: '/session/:sessionId/appium/device/push_file' }) ], [ 'listContexts', Object({ method: 'GET', path: '/session/:sessionId/contexts' }) ], [ 'uploadFile', Object({ method: 'POST', path: '/session/:sessionId/file' }) ], [ 'switchToParentFrame', Object({ method: 'POST', path: '/session/:sessionId/frame/parent' }) ], [ 'fullscreen', Object({ method: 'POST', path: '/session/:sessionId/window/fullscreen' }) ], [ 'sendAppToBackground', Object({ method: 'POST', path: '/session/:sessionId/appium/app/background' }) ], [ 'closeApp', Object({ method: 'POST', path: '/session/:sessionId/appium/app/close' }) ], [ 'getAppStrings', Object({ method: 'POST', path: '/session/:sessionId/appium/app/strings' }) ], [ 'launchSession', Object({ method: 'POST', path: '/session/:sessionId/appium/app/launch' }) ], [ 'resetApp', Object({ method: 'POST', path: '/session/:sessionId/appium/app/reset' }) ], [ 'hideSoftKeyboard', Object({ method: 'POST', path: '/session/:sessionId/appium/device/hide_keyboard' }) ], [ 'getDeviceTime', Object({ method: 'GET', path: '/session/:sessionId/appium/device/system_time' }) ], [ 'openDeviceNotifications', Object({ method: 'POST', path: '/session/:sessionId/appium/device/open_notifications' }) ], [ 'rotationGesture', Object({ method: 'POST', path: '/session/:sessionId/appium/device/rotate' }) ], [ 'shakeDevice', Object({ method: 'POST', path: '/session/:sessionId/appium/device/shake' }) ], [ 'sendChromiumCommand', Object({ method: 'POST', path: '/session/:sessionId/chromium/send_command' }) ], [ 'sendChromiumCommandAndGetResult', Object({ method: 'POST', path: '/session/:sessionId/chromium/send_command_and_get_result' }) ] ), log_: Logger({ name_: 'webdriver.http.Executor', level_: null, parent_: Logger({ name_: 'webdriver.http', level_: null, parent_: Logger({ name_: 'webdriver', level_: null, parent_: Logger({ name_: '', level_: OFF, parent_: null, handlers_: null }), handlers_: null }), handlers_: null }), handlers_: null }) }), fileDetector_: null, onQuit_: undefined, getNetworkConnection: Function, setNetworkConnection: Function, toggleAirplaneMode: Function, toggleWiFi: Function, toggleData: Function, toggleLocationServices: Function, getGeolocation: Function, setGeolocation: Function, getCurrentDeviceActivity: Function, startDeviceActivity: Function, getAppiumSettings: Function, setAppiumSettings: Function, getCurrentContext: Function, selectContext: Function, getScreenOrientation: Function, setScreenOrientation: Function, isDeviceLocked: Function, lockDevice: Function, unlockDevice: Function, installApp: Function, isAppInstalled: Function, removeApp: Function, pullFileFromDevice: Function, pullFolderFromDevice: Function, pushFileToDevice: Function, listContexts: Function, uploadFile: Function, switchToParentFrame: Function, fullscreen: Function, sendAppToBackground: Function, closeApp: Function, getAppStrings: Function, launchSession: Function, resetApp: Function, hideSoftKeyboard: Function, getDeviceTime: Function, openDeviceNotifications: Function, rotationGesture: Function, shakeDevice: Function, sendChromiumCommand: Function, sendChromiumCommandAndGetResult: Function }), element: Function, $: Function, $: Function, baseUrl: 'http://localhost:4200/', getPageTimeout: 10000, params: Object({  }), resetUrl: 'data:text/html,<html></html>', ready: ManagedPromise::17 {[[PromiseStatus]]: \"fulfilled\"}, trackOutstandingTimeouts_: true, mockModules_: [ Object({ name: 'protractorBaseModule_', script: Function, args: [ true ] }) ], ExpectedConditions: ProtractorExpectedConditions({ browser: <circular reference: Object> }), plugins_: Plugins({ setup: Function, onPrepare: Function, teardown: Function, postResults: Function, postTest: Function, onPageLoad: Function, onPageStable: Function, waitForPromise: Function, waitForCondition: Function, pluginObjs: [  ], assertions: Object({  }), resultsReported: false }), allScriptsTimeout: 11000, getProcessedConfig: Function, forkNewDriverInstance: Function, restart: Function, restartSync: Function, internalRootEl: '', internalIgnoreSynchronization: false }), getWebElements: Function, locator_: By(css selector, .invalid-feedback), actionResults_: null, click: Function, sendKeys: Function, getTagName: Function, getCssValue: Function, getAttribute: Function, getText: Function, getSize: Function, getLocation: Function, isEnabled: Function, isSelected: Function, submit: Function, clear: Function, isDisplayed: Function, getId: Function, takeScreenshot: Function }), click: Function, sendKeys: Function, getTagName: Function, getCssValue: Function, getAttribute: Function, getText: Function, getSize: Function, getLocation: Function, isEnabled: Function, isSelected: Function, submit: Function, clear: Function, isDisplayed: Function, getId: Function, takeScreenshot: Function }) to equal 'ISBN es obligatorio'."
        ],
        "trace": [
            "Error: Failed expectation\n    at D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\test\\prestamo.e2e-spec.ts:31:23\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)"
        ],
        "browserLogs": [],
        "screenShotFile": "00d3007c-00eb-0031-0089-004300360007.png",
        "timestamp": 1616000236265,
        "duration": 1095
    },
    {
        "description": "deber??a mostrar p??gina de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8796,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "005e0075-0024-00e4-0019-007b007b0019.png",
        "timestamp": 1616000721266,
        "duration": 3530
    },
    {
        "description": "deber??a mostrar mensaje error email obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8796,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00cf00d1-007d-0022-00c4-009700330077.png",
        "timestamp": 1616000725299,
        "duration": 954
    },
    {
        "description": "deber??a mostrar mensaje error email no valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8796,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00f90034-0055-00f7-0034-00c20013006e.png",
        "timestamp": 1616000726634,
        "duration": 1016
    },
    {
        "description": "muestra mensaje error password obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8796,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00df0038-0006-004c-0047-00bf0076005a.png",
        "timestamp": 1616000727961,
        "duration": 890
    },
    {
        "description": "redirecciona a la p??gina de home si login es valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8796,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00eb0057-00e6-0064-00b7-00f5008400ca.png",
        "timestamp": 1616000729153,
        "duration": 2061
    },
    {
        "description": "Muestra mensaje ISBN obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8796,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00700007-001c-009d-00ef-00aa00620092.png",
        "timestamp": 1616000731489,
        "duration": 977
    },
    {
        "description": "deber??a mostrar p??gina de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 19600,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00f40077-0089-0018-005d-00a800bf0033.png",
        "timestamp": 1616001002441,
        "duration": 2995
    },
    {
        "description": "deber??a mostrar mensaje error email obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 19600,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0057004d-003e-0020-0089-009400ee00d9.png",
        "timestamp": 1616001005910,
        "duration": 779
    },
    {
        "description": "deber??a mostrar mensaje error email no valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 19600,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "000400ad-0027-0084-00a8-00ed008b0051.png",
        "timestamp": 1616001007014,
        "duration": 984
    },
    {
        "description": "muestra mensaje error password obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 19600,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00460055-00a5-008f-0040-00c6004e0040.png",
        "timestamp": 1616001008306,
        "duration": 916
    },
    {
        "description": "redirecciona a la p??gina de home si login es valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 19600,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00820005-007c-0001-00ab-00f000e900dd.png",
        "timestamp": 1616001009542,
        "duration": 2018
    },
    {
        "description": "Muestra mensaje ISBN obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 19600,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "002d0078-00e3-00df-00a9-00cc002600da.png",
        "timestamp": 1616001011886,
        "duration": 1033
    },
    {
        "description": "Muestra mensaje error Nombre obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 19600,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "0081009c-0096-006a-00e6-001b001f008b.png",
        "timestamp": 1616001013284,
        "duration": 844
    },
    {
        "description": "deber??a mostrar p??gina de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 4624,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "007b0055-002b-008e-00f5-00eb009f00ba.png",
        "timestamp": 1616003065337,
        "duration": 995
    },
    {
        "description": "deber??a mostrar mensaje error email obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 4624,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "006600e4-0064-003a-00cc-00c500ff0022.png",
        "timestamp": 1616003066842,
        "duration": 970
    },
    {
        "description": "deber??a mostrar mensaje error email no valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 4624,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "007f00f4-0033-00b2-00d3-005f0052002b.png",
        "timestamp": 1616003068170,
        "duration": 1052
    },
    {
        "description": "muestra mensaje error password obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 4624,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00760081-004d-003f-0079-00ba00820005.png",
        "timestamp": 1616003069584,
        "duration": 956
    },
    {
        "description": "redirecciona a la p??gina de home si login es valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 4624,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00fb00e6-0039-00f0-00e1-001b00f90040.png",
        "timestamp": 1616003070893,
        "duration": 10644
    },
    {
        "description": "Muestra mensaje ISBN obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 4624,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "005d00dd-00c5-0066-001b-004c006f009c.png",
        "timestamp": 1616003081853,
        "duration": 1268
    },
    {
        "description": "deber??a mostrar p??gina de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 6008,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00530054-0022-0082-00fb-0023008800c4.png",
        "timestamp": 1616004148288,
        "duration": 19314
    },
    {
        "description": "deber??a mostrar mensaje error email obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 6008,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00010017-00cf-00c0-00cb-0021001d0035.png",
        "timestamp": 1616004168107,
        "duration": 814
    },
    {
        "description": "deber??a mostrar mensaje error email no valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 6008,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00490081-0065-001a-008e-0029009600ba.png",
        "timestamp": 1616004169231,
        "duration": 918
    },
    {
        "description": "muestra mensaje error password obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 6008,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "008b00be-0039-0047-00ac-002400800012.png",
        "timestamp": 1616004170486,
        "duration": 829
    },
    {
        "description": "redirecciona a la p??gina de home si login es valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 6008,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00de00a7-003a-000b-00fd-004800ac0051.png",
        "timestamp": 1616004171606,
        "duration": 9196
    },
    {
        "description": "Muestra mensaje error ISBN obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 6008,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00fa0066-0004-00c5-00c4-004d004900de.png",
        "timestamp": 1616004181107,
        "duration": 1242
    },
    {
        "description": "Muestra mensaje error Nombre obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 6008,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "009400ca-0057-00f9-004c-00d10021005d.png",
        "timestamp": 1616004182697,
        "duration": 893
    },
    {
        "description": "deber??a mostrar p??gina de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 1924,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00e300ca-00a8-00b1-0037-004c002600b3.png",
        "timestamp": 1616008736738,
        "duration": 826
    },
    {
        "description": "Muestra mensajes error campos obligatorios|work-space project libro",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 1924,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616008737790,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616008737792,
                "type": ""
            }
        ],
        "screenShotFile": "00560070-0037-0018-00fc-00f2007a0048.png",
        "timestamp": 1616008750525,
        "duration": 696
    },
    {
        "description": "deber??a mostrar mensaje error email obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 1924,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616008751341,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616008751342,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616008752386,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616008752386,
                "type": ""
            }
        ],
        "screenShotFile": "00e900b1-00a9-0037-00f6-00d6003000a0.png",
        "timestamp": 1616008751564,
        "duration": 859
    },
    {
        "description": "deber??a mostrar mensaje error email no valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 1924,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616008753495,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616008753496,
                "type": ""
            }
        ],
        "screenShotFile": "006500fd-00e4-0071-00c9-001a009300a4.png",
        "timestamp": 1616008752765,
        "duration": 995
    },
    {
        "description": "muestra mensaje error password obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 1924,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616008754905,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616008754906,
                "type": ""
            }
        ],
        "screenShotFile": "006700e9-005d-009a-002a-008200aa005b.png",
        "timestamp": 1616008754106,
        "duration": 911
    },
    {
        "description": "redirecciona a la p??gina de home si login es valido|work-space project login",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 1924,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: script timeout\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.19042 x86_64)"
        ],
        "trace": [
            "ScriptTimeoutError: script timeout\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.19042 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: Protractor.waitForAngular()\n    at Driver.schedule (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at ProtractorBrowser.executeAsyncScript_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:423:28)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:454:33\n    at ManagedPromise.invokeCallback_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: Run it(\"redirecciona a la p??gina de home si login es valido\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError: \n    at Suite.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\test\\login.e2e-spec.ts:50:3)\n    at addSpecsToSuite (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\test\\login.e2e-spec.ts:5:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Module.m._compile (D:\\Proyectos\\ADNCeiba\\angular-base\\node_modules\\ts-node\\src\\index.ts:439:23)\n    at Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Object.require.extensions.<computed> [as .ts] (D:\\Proyectos\\ADNCeiba\\angular-base\\node_modules\\ts-node\\src\\index.ts:442:12)"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616008756073,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616008756075,
                "type": ""
            }
        ],
        "screenShotFile": "00ed00e4-0091-0058-00ca-002d004c0032.png",
        "timestamp": 1616008755335,
        "duration": 12047
    },
    {
        "description": "Muestra mensaje error ISBN obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 1924,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00650070-0041-0038-0029-00ae00d100a6.png",
        "timestamp": 1616008767710,
        "duration": 886
    },
    {
        "description": "Muestra mensaje error Nombre obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 1924,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616008768727,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616008768728,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616008769581,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616008769582,
                "type": ""
            }
        ],
        "screenShotFile": "005f000a-00df-00ff-0046-00bb00a300b5.png",
        "timestamp": 1616008768875,
        "duration": 767
    },
    {
        "description": "deber??a mostrar p??gina de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 20984,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "000c00d7-00fb-0057-00ca-003000eb00c7.png",
        "timestamp": 1616008991556,
        "duration": 28156
    },
    {
        "description": "Muestra mensajes error campos obligatorios|work-space project libro",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 20984,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616009019775,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616009019776,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616009021003,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616009021004,
                "type": ""
            }
        ],
        "screenShotFile": "00810074-008b-0080-0055-00f700d000ad.png",
        "timestamp": 1616009020223,
        "duration": 804
    },
    {
        "description": "deber??a mostrar mensaje error email obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 20984,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616009022025,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616009022025,
                "type": ""
            }
        ],
        "screenShotFile": "00dd0035-004c-002b-00f5-001400a50024.png",
        "timestamp": 1616009021320,
        "duration": 870
    },
    {
        "description": "deber??a mostrar mensaje error email no valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 20984,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616009023282,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616009023282,
                "type": ""
            }
        ],
        "screenShotFile": "00250099-001e-0067-0098-00350027001c.png",
        "timestamp": 1616009022532,
        "duration": 941
    },
    {
        "description": "muestra mensaje error password obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 20984,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616009024618,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616009024618,
                "type": ""
            }
        ],
        "screenShotFile": "00240015-00e9-000e-0098-00800081003a.png",
        "timestamp": 1616009023854,
        "duration": 867
    },
    {
        "description": "redirecciona a la p??gina de home si login es valido|work-space project login",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 20984,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: script timeout\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.19042 x86_64)"
        ],
        "trace": [
            "ScriptTimeoutError: script timeout\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.19042 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: Protractor.waitForAngular()\n    at Driver.schedule (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at ProtractorBrowser.executeAsyncScript_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:423:28)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:454:33\n    at ManagedPromise.invokeCallback_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: Run it(\"redirecciona a la p??gina de home si login es valido\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError: \n    at Suite.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\test\\login.e2e-spec.ts:50:3)\n    at addSpecsToSuite (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\test\\login.e2e-spec.ts:5:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Module.m._compile (D:\\Proyectos\\ADNCeiba\\angular-base\\node_modules\\ts-node\\src\\index.ts:439:23)\n    at Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Object.require.extensions.<computed> [as .ts] (D:\\Proyectos\\ADNCeiba\\angular-base\\node_modules\\ts-node\\src\\index.ts:442:12)"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616009025770,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616009025771,
                "type": ""
            }
        ],
        "screenShotFile": "00dc0027-0035-00da-002a-00c100280070.png",
        "timestamp": 1616009025065,
        "duration": 11959
    },
    {
        "description": "Muestra mensaje error ISBN obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 20984,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616009038126,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616009038127,
                "type": ""
            }
        ],
        "screenShotFile": "008500b8-00c2-0010-0051-003b00320037.png",
        "timestamp": 1616009037388,
        "duration": 766
    },
    {
        "description": "Muestra mensaje error Nombre obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 20984,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "001a007e-0078-00f3-0025-00d7004400b3.png",
        "timestamp": 1616009038451,
        "duration": 567
    },
    {
        "description": "deber??a mostrar p??gina de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 14476,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "001f0080-00c0-00ab-009e-00e000b0000b.png",
        "timestamp": 1616009063408,
        "duration": 19760
    },
    {
        "description": "deber??a mostrar mensaje error email obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 14476,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616009083261,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616009083262,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616009084637,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616009084637,
                "type": ""
            }
        ],
        "screenShotFile": "00870047-00b8-0050-0068-00a9006d00cc.png",
        "timestamp": 1616009083737,
        "duration": 890
    },
    {
        "description": "deber??a mostrar mensaje error email no valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 14476,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616009085926,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616009085926,
                "type": ""
            }
        ],
        "screenShotFile": "000c008d-007c-000b-00ef-00fd00de00ea.png",
        "timestamp": 1616009084970,
        "duration": 1150
    },
    {
        "description": "muestra mensaje error password obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 14476,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616009087172,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616009087172,
                "type": ""
            }
        ],
        "screenShotFile": "00ba006d-00e5-0051-003d-0028002400e2.png",
        "timestamp": 1616009086442,
        "duration": 879
    },
    {
        "description": "redirecciona a la p??gina de home si login es valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 14476,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616009088455,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616009088456,
                "type": ""
            }
        ],
        "screenShotFile": "00fb00cc-0097-00cf-00cf-004200550072.png",
        "timestamp": 1616009087666,
        "duration": 4814
    },
    {
        "description": "Muestra mensaje error ISBN obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 14476,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616009093535,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616009093535,
                "type": ""
            }
        ],
        "screenShotFile": "00bf003a-007d-00be-009e-00f90045006c.png",
        "timestamp": 1616009092815,
        "duration": 931
    },
    {
        "description": "Muestra mensaje error Nombre obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 14476,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616009094801,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616009094801,
                "type": ""
            }
        ],
        "screenShotFile": "00b00036-0061-0099-00d7-0043006000eb.png",
        "timestamp": 1616009094088,
        "duration": 761
    },
    {
        "description": "deber??a mostrar p??gina de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 14296,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00540095-007d-00a4-0069-0041000300fc.png",
        "timestamp": 1616009667499,
        "duration": 827
    },
    {
        "description": "Muestra mensajes error campos obligatorios|work-space project libro",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 14296,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616009668543,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616009668544,
                "type": ""
            }
        ],
        "screenShotFile": "00310016-0033-0071-00d3-00ee002900a0.png",
        "timestamp": 1616009668827,
        "duration": 661
    },
    {
        "description": "deber??a mostrar mensaje error email obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 14296,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616009669643,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616009669644,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616009670604,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616009670604,
                "type": ""
            }
        ],
        "screenShotFile": "00f800d7-00cf-0051-00c8-008a00600012.png",
        "timestamp": 1616009669810,
        "duration": 796
    },
    {
        "description": "deber??a mostrar mensaje error email no valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 14296,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616009671774,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616009671774,
                "type": ""
            }
        ],
        "screenShotFile": "00ba000e-0075-00e4-001c-009000190060.png",
        "timestamp": 1616009670918,
        "duration": 1046
    },
    {
        "description": "muestra mensaje error password obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 14296,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616009673190,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616009673191,
                "type": ""
            }
        ],
        "screenShotFile": "001f0004-00eb-003b-0014-00bd00ec00a0.png",
        "timestamp": 1616009672328,
        "duration": 932
    },
    {
        "description": "redirecciona a la p??gina de home si login es valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 14296,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616009674419,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616009674419,
                "type": ""
            }
        ],
        "screenShotFile": "0073005b-0013-00a0-00db-001a00c100d9.png",
        "timestamp": 1616009673551,
        "duration": 1855
    },
    {
        "description": "Muestra mensaje error ISBN obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 14296,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616009676519,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616009676519,
                "type": ""
            }
        ],
        "screenShotFile": "00ef0031-00bc-00a2-006f-00be009400ba.png",
        "timestamp": 1616009675699,
        "duration": 1064
    },
    {
        "description": "Muestra mensaje error Nombre obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 14296,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616009677839,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616009677839,
                "type": ""
            }
        ],
        "screenShotFile": "00f20041-00ed-0013-0004-008d00e90086.png",
        "timestamp": 1616009677079,
        "duration": 891
    },
    {
        "description": "deber??a mostrar p??gina de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 21412,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "003f003d-0048-0055-001c-00d00050009e.png",
        "timestamp": 1616009990006,
        "duration": 812
    },
    {
        "description": "Muestra mensajes error campos obligatorios|work-space project libro",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 21412,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616009991032,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616009991032,
                "type": ""
            }
        ],
        "screenShotFile": "0084000e-003f-0054-0005-00800052000e.png",
        "timestamp": 1616009991298,
        "duration": 887
    },
    {
        "description": "Muestra mensaje error nombre obligatorio|work-space project libro",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 21412,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616009992209,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616009992210,
                "type": ""
            }
        ],
        "screenShotFile": "00750028-00a1-00ea-0040-0009008300f8.png",
        "timestamp": 1616009992462,
        "duration": 799
    },
    {
        "description": "deber??a mostrar mensaje error email obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 21412,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616009993270,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616009993271,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616009994365,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616009994365,
                "type": ""
            }
        ],
        "screenShotFile": "00540082-00b5-0032-006d-001c00010030.png",
        "timestamp": 1616009993558,
        "duration": 899
    },
    {
        "description": "deber??a mostrar mensaje error email no valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 21412,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616009995604,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616009995604,
                "type": ""
            }
        ],
        "screenShotFile": "00300060-00e2-00ab-005a-000500c000c4.png",
        "timestamp": 1616009994764,
        "duration": 985
    },
    {
        "description": "muestra mensaje error password obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 21412,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616009996897,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616009996897,
                "type": ""
            }
        ],
        "screenShotFile": "004e0076-00d0-0079-003f-005800cc0055.png",
        "timestamp": 1616009996075,
        "duration": 894
    },
    {
        "description": "redirecciona a la p??gina de home si login es valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 21412,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616009998084,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616009998085,
                "type": ""
            }
        ],
        "screenShotFile": "00e20004-00c8-00b6-00e5-00df00ac0048.png",
        "timestamp": 1616009997301,
        "duration": 2160
    },
    {
        "description": "Muestra mensaje error ISBN obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 21412,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616010000597,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616010000598,
                "type": ""
            }
        ],
        "screenShotFile": "0014001d-004c-002a-00f6-00fe0017000f.png",
        "timestamp": 1616009999775,
        "duration": 978
    },
    {
        "description": "Muestra mensaje error Nombre obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 21412,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616010001896,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616010001896,
                "type": ""
            }
        ],
        "screenShotFile": "00e7003b-0022-0095-009e-00ba00c00031.png",
        "timestamp": 1616010001094,
        "duration": 850
    },
    {
        "description": "deber??a mostrar p??gina de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 6696,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "006b0070-005d-00f6-0013-00d700dd00d7.png",
        "timestamp": 1616010370404,
        "duration": 1002
    },
    {
        "description": "Muestra mensajes error campos obligatorios|work-space project libro",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 6696,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616010371506,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616010371507,
                "type": ""
            }
        ],
        "screenShotFile": "007700a6-006a-00b9-000e-00ba004c0097.png",
        "timestamp": 1616010371898,
        "duration": 807
    },
    {
        "description": "Muestra mensaje error nombre obligatorio|work-space project libro",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 6696,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616010372725,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616010372726,
                "type": ""
            }
        ],
        "screenShotFile": "0067004f-0087-00ba-007b-003f00a2004e.png",
        "timestamp": 1616010372997,
        "duration": 785
    },
    {
        "description": "deber??a mostrar mensaje error email obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 6696,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616010373819,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616010373820,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616010374875,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616010374875,
                "type": ""
            }
        ],
        "screenShotFile": "00e50027-003c-00a8-000a-005b00c200b6.png",
        "timestamp": 1616010374066,
        "duration": 892
    },
    {
        "description": "deber??a mostrar mensaje error email no valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 6696,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616010376131,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616010376131,
                "type": ""
            }
        ],
        "screenShotFile": "009d0000-0080-00f5-006e-0034005d0041.png",
        "timestamp": 1616010375315,
        "duration": 978
    },
    {
        "description": "muestra mensaje error password obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 6696,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616010377497,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616010377497,
                "type": ""
            }
        ],
        "screenShotFile": "00d3008f-0053-00c9-006a-000c00ef0072.png",
        "timestamp": 1616010376614,
        "duration": 983
    },
    {
        "description": "redirecciona a la p??gina de home si login es valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 6696,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616010378751,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616010378751,
                "type": ""
            }
        ],
        "screenShotFile": "00280094-007d-0031-0055-008900730095.png",
        "timestamp": 1616010377937,
        "duration": 2185
    },
    {
        "description": "Muestra mensaje error ISBN obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 6696,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616010381179,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616010381179,
                "type": ""
            }
        ],
        "screenShotFile": "00c400eb-0056-00bb-0083-0016009f005f.png",
        "timestamp": 1616010380461,
        "duration": 819
    },
    {
        "description": "Muestra mensaje error Nombre obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 6696,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616010382327,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616010382328,
                "type": ""
            }
        ],
        "screenShotFile": "00f9006f-003b-0058-00ae-002a003700b4.png",
        "timestamp": 1616010381603,
        "duration": 974
    },
    {
        "description": "deber??a mostrar p??gina de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 12568,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "001f00ad-00aa-00db-004b-00c20097006a.png",
        "timestamp": 1616010497521,
        "duration": 846
    },
    {
        "description": "Muestra mensajes error campos obligatorios|work-space project libro",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 12568,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616010498592,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616010498594,
                "type": ""
            }
        ],
        "screenShotFile": "00c00028-0060-00b8-00a8-0031007600c8.png",
        "timestamp": 1616010498901,
        "duration": 862
    },
    {
        "description": "Muestra mensaje error nombre obligatorio|work-space project libro",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 12568,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL."
        ],
        "trace": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL.\n    at Timeout._onTimeout (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4281:23)\n    at listOnTimeout (internal/timers.js:554:17)\n    at processTimers (internal/timers.js:497:7)"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616010499777,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616010499778,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616010530878,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616010530878,
                "type": ""
            }
        ],
        "screenShotFile": "003a0041-0065-00e5-00fd-005f00570045.png",
        "timestamp": 1616010500071,
        "duration": 30953
    },
    {
        "description": "deber??a mostrar mensaje error email obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 12568,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616010532505,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616010532506,
                "type": ""
            }
        ],
        "screenShotFile": "00100078-00a0-00a7-00ec-00ee009400db.png",
        "timestamp": 1616010531328,
        "duration": 1245
    },
    {
        "description": "deber??a mostrar mensaje error email no valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 12568,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616010533751,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616010533752,
                "type": ""
            }
        ],
        "screenShotFile": "00b00068-00d8-00f4-00f0-00d800620070.png",
        "timestamp": 1616010532919,
        "duration": 912
    },
    {
        "description": "muestra mensaje error password obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 12568,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616010535091,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616010535092,
                "type": ""
            }
        ],
        "screenShotFile": "00e400e3-000d-003e-008a-009500d20042.png",
        "timestamp": 1616010534141,
        "duration": 1070
    },
    {
        "description": "redirecciona a la p??gina de home si login es valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 12568,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616010536443,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616010536443,
                "type": ""
            }
        ],
        "screenShotFile": "008900f3-002b-0059-0032-005c00f0006f.png",
        "timestamp": 1616010535518,
        "duration": 1718
    },
    {
        "description": "Muestra mensaje error ISBN obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 12568,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616010538401,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616010538403,
                "type": ""
            }
        ],
        "screenShotFile": "00ee001d-00b7-001c-00ec-00390064000b.png",
        "timestamp": 1616010537535,
        "duration": 1147
    },
    {
        "description": "Muestra mensaje error Nombre obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 12568,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616010539938,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616010539938,
                "type": ""
            }
        ],
        "screenShotFile": "006e00b4-003b-0062-0088-00ad00a600fa.png",
        "timestamp": 1616010539021,
        "duration": 1090
    },
    {
        "description": "deber??a mostrar p??gina de login|workspace-project App",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 17928,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: zone-testing.js is needed for the fakeAsync() test helper but could not be found.\n        Please make sure that your environment includes zone.js/dist/zone-testing.js"
        ],
        "trace": [
            "Error: zone-testing.js is needed for the fakeAsync() test helper but could not be found.\n        Please make sure that your environment includes zone.js/dist/zone-testing.js\n    at resetFakeAsyncZone (D:\\Proyectos\\ADNCeiba\\packages\\core\\testing\\src\\fake_async.ts:25:9)\n    at UserContext.<anonymous> (D:\\Proyectos\\ADNCeiba\\packages\\core\\testing\\src\\before_each.ts:26:5)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\nFrom: Task: Run beforeEach in control flow\n    at UserContext.<anonymous> (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at QueueRunner.execute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4199:10)\n    at Spec.queueRunnerFactory (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:909:35)\n    at Spec.execute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:526:10)\n    at UserContext.fn (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:5340:37)\n    at attempt (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at QueueRunner.execute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4199:10)\nFrom asynchronous test: \nError: \n    at D:\\Proyectos\\ADNCeiba\\packages\\core\\testing\\src\\before_each.ts:24:11\n    at D:\\Proyectos\\ADNCeiba\\angular-base\\node_modules\\@angular\\core\\bundles\\core-testing.umd.js:8:68\n    at Object.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\node_modules\\@angular\\core\\bundles\\core-testing.umd.js:11:2)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Module.load (internal/modules/cjs/loader.js:928:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:769:14)\n    at Module.require (internal/modules/cjs/loader.js:952:19)\n    at require (internal/modules/cjs/helpers.js:88:18)"
        ],
        "browserLogs": [],
        "screenShotFile": "00690064-0092-002b-0091-0072002a0001.png",
        "timestamp": 1616011552646,
        "duration": 947
    },
    {
        "description": "encountered a declaration exception|work-space project libro",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 17928,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: zone-testing.js is needed for the fakeAsync() test helper but could not be found.\n        Please make sure that your environment includes zone.js/dist/zone-testing.js",
            "Error: zone-testing.js is needed for the fakeAsync() test helper but could not be found.\n        Please make sure that your environment includes zone.js/dist/zone-testing.js"
        ],
        "trace": [
            "Error: zone-testing.js is needed for the fakeAsync() test helper but could not be found.\n        Please make sure that your environment includes zone.js/dist/zone-testing.js\n    at resetFakeAsyncZone (D:\\Proyectos\\ADNCeiba\\packages\\core\\testing\\src\\fake_async.ts:25:9)\n    at UserContext.<anonymous> (D:\\Proyectos\\ADNCeiba\\packages\\core\\testing\\src\\before_each.ts:26:5)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\nFrom: Task: Run beforeEach in control flow\n    at UserContext.<anonymous> (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at QueueRunner.execute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4199:10)\n    at Spec.queueRunnerFactory (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:909:35)\n    at Spec.execute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:526:10)\n    at UserContext.fn (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:5340:37)\n    at attempt (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at QueueRunner.execute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4199:10)\nFrom asynchronous test: \nError: \n    at D:\\Proyectos\\ADNCeiba\\packages\\core\\testing\\src\\before_each.ts:24:11\n    at D:\\Proyectos\\ADNCeiba\\angular-base\\node_modules\\@angular\\core\\bundles\\core-testing.umd.js:8:68\n    at Object.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\node_modules\\@angular\\core\\bundles\\core-testing.umd.js:11:2)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Module.load (internal/modules/cjs/loader.js:928:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:769:14)\n    at Module.require (internal/modules/cjs/loader.js:952:19)\n    at require (internal/modules/cjs/helpers.js:88:18)",
            "Error: zone-testing.js is needed for the fakeAsync() test helper but could not be found.\n        Please make sure that your environment includes zone.js/dist/zone-testing.js\n    at Object.fakeAsync (D:\\Proyectos\\ADNCeiba\\packages\\core\\testing\\src\\fake_async.ts:51:9)\n    at Suite.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\test\\libro.e2e-spec.ts:11:52)\n    at addSpecsToSuite (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\test\\libro.e2e-spec.ts:4:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Module.m._compile (D:\\Proyectos\\ADNCeiba\\angular-base\\node_modules\\ts-node\\src\\index.ts:439:23)\n    at Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Object.require.extensions.<computed> [as .ts] (D:\\Proyectos\\ADNCeiba\\angular-base\\node_modules\\ts-node\\src\\index.ts:442:12)"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616011553692,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616011553692,
                "type": ""
            }
        ],
        "screenShotFile": "009b00df-0006-003f-00b7-00ec00f900b2.png",
        "timestamp": 1616011554151,
        "duration": 7
    },
    {
        "description": "deber??a mostrar mensaje error email obligatorio|work-space project login",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 17928,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: zone-testing.js is needed for the fakeAsync() test helper but could not be found.\n        Please make sure that your environment includes zone.js/dist/zone-testing.js"
        ],
        "trace": [
            "Error: zone-testing.js is needed for the fakeAsync() test helper but could not be found.\n        Please make sure that your environment includes zone.js/dist/zone-testing.js\n    at resetFakeAsyncZone (D:\\Proyectos\\ADNCeiba\\packages\\core\\testing\\src\\fake_async.ts:25:9)\n    at UserContext.<anonymous> (D:\\Proyectos\\ADNCeiba\\packages\\core\\testing\\src\\before_each.ts:26:5)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\nFrom: Task: Run beforeEach in control flow\n    at UserContext.<anonymous> (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at QueueRunner.execute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4199:10)\n    at Spec.queueRunnerFactory (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:909:35)\n    at Spec.execute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:526:10)\n    at UserContext.fn (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:5340:37)\n    at attempt (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at QueueRunner.execute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4199:10)\nFrom asynchronous test: \nError: \n    at D:\\Proyectos\\ADNCeiba\\packages\\core\\testing\\src\\before_each.ts:24:11\n    at D:\\Proyectos\\ADNCeiba\\angular-base\\node_modules\\@angular\\core\\bundles\\core-testing.umd.js:8:68\n    at Object.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\node_modules\\@angular\\core\\bundles\\core-testing.umd.js:11:2)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Module.load (internal/modules/cjs/loader.js:928:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:769:14)\n    at Module.require (internal/modules/cjs/loader.js:952:19)\n    at require (internal/modules/cjs/helpers.js:88:18)"
        ],
        "browserLogs": [],
        "screenShotFile": "00a1004b-00e2-00b3-00f3-00c900f300f6.png",
        "timestamp": 1616011554469,
        "duration": 889
    },
    {
        "description": "deber??a mostrar mensaje error email no valido|work-space project login",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 17928,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: zone-testing.js is needed for the fakeAsync() test helper but could not be found.\n        Please make sure that your environment includes zone.js/dist/zone-testing.js"
        ],
        "trace": [
            "Error: zone-testing.js is needed for the fakeAsync() test helper but could not be found.\n        Please make sure that your environment includes zone.js/dist/zone-testing.js\n    at resetFakeAsyncZone (D:\\Proyectos\\ADNCeiba\\packages\\core\\testing\\src\\fake_async.ts:25:9)\n    at UserContext.<anonymous> (D:\\Proyectos\\ADNCeiba\\packages\\core\\testing\\src\\before_each.ts:26:5)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\nFrom: Task: Run beforeEach in control flow\n    at UserContext.<anonymous> (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at QueueRunner.execute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4199:10)\n    at Spec.queueRunnerFactory (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:909:35)\n    at Spec.execute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:526:10)\n    at UserContext.fn (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:5340:37)\n    at attempt (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\nFrom asynchronous test: \nError: \n    at D:\\Proyectos\\ADNCeiba\\packages\\core\\testing\\src\\before_each.ts:24:11\n    at D:\\Proyectos\\ADNCeiba\\angular-base\\node_modules\\@angular\\core\\bundles\\core-testing.umd.js:8:68\n    at Object.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\node_modules\\@angular\\core\\bundles\\core-testing.umd.js:11:2)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Module.load (internal/modules/cjs/loader.js:928:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:769:14)\n    at Module.require (internal/modules/cjs/loader.js:952:19)\n    at require (internal/modules/cjs/helpers.js:88:18)"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616011555372,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616011555373,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616011556561,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616011556561,
                "type": ""
            }
        ],
        "screenShotFile": "0031003c-0049-0069-00ee-003c00cb003c.png",
        "timestamp": 1616011555679,
        "duration": 1093
    },
    {
        "description": "muestra mensaje error password obligatorio|work-space project login",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 17928,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: zone-testing.js is needed for the fakeAsync() test helper but could not be found.\n        Please make sure that your environment includes zone.js/dist/zone-testing.js"
        ],
        "trace": [
            "Error: zone-testing.js is needed for the fakeAsync() test helper but could not be found.\n        Please make sure that your environment includes zone.js/dist/zone-testing.js\n    at resetFakeAsyncZone (D:\\Proyectos\\ADNCeiba\\packages\\core\\testing\\src\\fake_async.ts:25:9)\n    at UserContext.<anonymous> (D:\\Proyectos\\ADNCeiba\\packages\\core\\testing\\src\\before_each.ts:26:5)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\nFrom: Task: Run beforeEach in control flow\n    at UserContext.<anonymous> (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at QueueRunner.execute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4199:10)\n    at Spec.queueRunnerFactory (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:909:35)\n    at Spec.execute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:526:10)\n    at UserContext.fn (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:5340:37)\n    at attempt (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\nFrom asynchronous test: \nError: \n    at D:\\Proyectos\\ADNCeiba\\packages\\core\\testing\\src\\before_each.ts:24:11\n    at D:\\Proyectos\\ADNCeiba\\angular-base\\node_modules\\@angular\\core\\bundles\\core-testing.umd.js:8:68\n    at Object.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\node_modules\\@angular\\core\\bundles\\core-testing.umd.js:11:2)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Module.load (internal/modules/cjs/loader.js:928:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:769:14)\n    at Module.require (internal/modules/cjs/loader.js:952:19)\n    at require (internal/modules/cjs/helpers.js:88:18)"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616011558062,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616011558063,
                "type": ""
            }
        ],
        "screenShotFile": "0019003f-006b-0029-006d-000800c70006.png",
        "timestamp": 1616011557113,
        "duration": 1067
    },
    {
        "description": "redirecciona a la p??gina de home si login es valido|work-space project login",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 17928,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: zone-testing.js is needed for the fakeAsync() test helper but could not be found.\n        Please make sure that your environment includes zone.js/dist/zone-testing.js"
        ],
        "trace": [
            "Error: zone-testing.js is needed for the fakeAsync() test helper but could not be found.\n        Please make sure that your environment includes zone.js/dist/zone-testing.js\n    at resetFakeAsyncZone (D:\\Proyectos\\ADNCeiba\\packages\\core\\testing\\src\\fake_async.ts:25:9)\n    at UserContext.<anonymous> (D:\\Proyectos\\ADNCeiba\\packages\\core\\testing\\src\\before_each.ts:26:5)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\nFrom: Task: Run beforeEach in control flow\n    at UserContext.<anonymous> (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at QueueRunner.execute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4199:10)\n    at Spec.queueRunnerFactory (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:909:35)\n    at Spec.execute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:526:10)\n    at UserContext.fn (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:5340:37)\n    at attempt (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\nFrom asynchronous test: \nError: \n    at D:\\Proyectos\\ADNCeiba\\packages\\core\\testing\\src\\before_each.ts:24:11\n    at D:\\Proyectos\\ADNCeiba\\angular-base\\node_modules\\@angular\\core\\bundles\\core-testing.umd.js:8:68\n    at Object.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\node_modules\\@angular\\core\\bundles\\core-testing.umd.js:11:2)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Module.load (internal/modules/cjs/loader.js:928:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:769:14)\n    at Module.require (internal/modules/cjs/loader.js:952:19)\n    at require (internal/modules/cjs/helpers.js:88:18)"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616011559515,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616011559516,
                "type": ""
            }
        ],
        "screenShotFile": "00250077-0053-007a-00b8-00a30058001d.png",
        "timestamp": 1616011558508,
        "duration": 2079
    },
    {
        "description": "Muestra mensaje error ISBN obligatorio|workspace-project Prestamo",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 17928,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: zone-testing.js is needed for the fakeAsync() test helper but could not be found.\n        Please make sure that your environment includes zone.js/dist/zone-testing.js"
        ],
        "trace": [
            "Error: zone-testing.js is needed for the fakeAsync() test helper but could not be found.\n        Please make sure that your environment includes zone.js/dist/zone-testing.js\n    at resetFakeAsyncZone (D:\\Proyectos\\ADNCeiba\\packages\\core\\testing\\src\\fake_async.ts:25:9)\n    at UserContext.<anonymous> (D:\\Proyectos\\ADNCeiba\\packages\\core\\testing\\src\\before_each.ts:26:5)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\nFrom: Task: Run beforeEach in control flow\n    at UserContext.<anonymous> (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at QueueRunner.execute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4199:10)\n    at Spec.queueRunnerFactory (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:909:35)\n    at Spec.execute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:526:10)\n    at UserContext.fn (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:5340:37)\n    at attempt (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at QueueRunner.execute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4199:10)\nFrom asynchronous test: \nError: \n    at D:\\Proyectos\\ADNCeiba\\packages\\core\\testing\\src\\before_each.ts:24:11\n    at D:\\Proyectos\\ADNCeiba\\angular-base\\node_modules\\@angular\\core\\bundles\\core-testing.umd.js:8:68\n    at Object.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\node_modules\\@angular\\core\\bundles\\core-testing.umd.js:11:2)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Module.load (internal/modules/cjs/loader.js:928:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:769:14)\n    at Module.require (internal/modules/cjs/loader.js:952:19)\n    at require (internal/modules/cjs/helpers.js:88:18)"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616011561870,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616011561870,
                "type": ""
            }
        ],
        "screenShotFile": "009400ae-001f-005c-00c0-002f009d0037.png",
        "timestamp": 1616011560893,
        "duration": 1171
    },
    {
        "description": "Muestra mensaje error Nombre obligatorio|workspace-project Prestamo",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 17928,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: zone-testing.js is needed for the fakeAsync() test helper but could not be found.\n        Please make sure that your environment includes zone.js/dist/zone-testing.js"
        ],
        "trace": [
            "Error: zone-testing.js is needed for the fakeAsync() test helper but could not be found.\n        Please make sure that your environment includes zone.js/dist/zone-testing.js\n    at resetFakeAsyncZone (D:\\Proyectos\\ADNCeiba\\packages\\core\\testing\\src\\fake_async.ts:25:9)\n    at UserContext.<anonymous> (D:\\Proyectos\\ADNCeiba\\packages\\core\\testing\\src\\before_each.ts:26:5)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\nFrom: Task: Run beforeEach in control flow\n    at UserContext.<anonymous> (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at QueueRunner.execute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4199:10)\n    at Spec.queueRunnerFactory (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:909:35)\n    at Spec.execute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:526:10)\n    at UserContext.fn (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:5340:37)\n    at attempt (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\nFrom asynchronous test: \nError: \n    at D:\\Proyectos\\ADNCeiba\\packages\\core\\testing\\src\\before_each.ts:24:11\n    at D:\\Proyectos\\ADNCeiba\\angular-base\\node_modules\\@angular\\core\\bundles\\core-testing.umd.js:8:68\n    at Object.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\node_modules\\@angular\\core\\bundles\\core-testing.umd.js:11:2)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Module.load (internal/modules/cjs/loader.js:928:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:769:14)\n    at Module.require (internal/modules/cjs/loader.js:952:19)\n    at require (internal/modules/cjs/helpers.js:88:18)"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616011563237,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616011563237,
                "type": ""
            }
        ],
        "screenShotFile": "000100eb-00c1-006e-00c6-001100a80081.png",
        "timestamp": 1616011562388,
        "duration": 1015
    },
    {
        "description": "encountered a declaration exception|workspace-project App",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 20396,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: zone-testing.js is needed for the fakeAsync() test helper but could not be found.\n        Please make sure that your environment includes zone.js/dist/zone-testing.js",
            "Error: zone-testing.js is needed for the fakeAsync() test helper but could not be found.\n        Please make sure that your environment includes zone.js/dist/zone-testing.js"
        ],
        "trace": [
            "Error: zone-testing.js is needed for the fakeAsync() test helper but could not be found.\n        Please make sure that your environment includes zone.js/dist/zone-testing.js\n    at resetFakeAsyncZone (D:\\Proyectos\\ADNCeiba\\packages\\core\\testing\\src\\fake_async.ts:25:9)\n    at UserContext.<anonymous> (D:\\Proyectos\\ADNCeiba\\packages\\core\\testing\\src\\before_each.ts:26:5)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\nFrom: Task: Run beforeEach in control flow\n    at UserContext.<anonymous> (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at QueueRunner.execute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4199:10)\n    at Spec.queueRunnerFactory (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:909:35)\n    at Spec.execute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:526:10)\n    at UserContext.fn (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:5340:37)\n    at attempt (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at QueueRunner.execute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4199:10)\nFrom asynchronous test: \nError: \n    at D:\\Proyectos\\ADNCeiba\\packages\\core\\testing\\src\\before_each.ts:24:11\n    at D:\\Proyectos\\ADNCeiba\\angular-base\\node_modules\\@angular\\core\\bundles\\core-testing.umd.js:8:68\n    at Object.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\node_modules\\@angular\\core\\bundles\\core-testing.umd.js:11:2)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Module.load (internal/modules/cjs/loader.js:928:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:769:14)\n    at Module.require (internal/modules/cjs/loader.js:952:19)\n    at require (internal/modules/cjs/helpers.js:88:18)",
            "Error: zone-testing.js is needed for the fakeAsync() test helper but could not be found.\n        Please make sure that your environment includes zone.js/dist/zone-testing.js\n    at Object.fakeAsync (D:\\Proyectos\\ADNCeiba\\packages\\core\\testing\\src\\fake_async.ts:51:9)\n    at Suite.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\app.e2e-spec.ts:12:41)\n    at addSpecsToSuite (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\app.e2e-spec.ts:5:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Module.m._compile (D:\\Proyectos\\ADNCeiba\\angular-base\\node_modules\\ts-node\\src\\index.ts:439:23)\n    at Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Object.require.extensions.<computed> [as .ts] (D:\\Proyectos\\ADNCeiba\\angular-base\\node_modules\\ts-node\\src\\index.ts:442:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "00040092-002f-00f8-00af-009700b50060.png",
        "timestamp": 1616011729837,
        "duration": 15
    },
    {
        "description": "encountered a declaration exception|work-space project libro",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 20396,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: zone-testing.js is needed for the fakeAsync() test helper but could not be found.\n        Please make sure that your environment includes zone.js/dist/zone-testing.js",
            "Error: zone-testing.js is needed for the fakeAsync() test helper but could not be found.\n        Please make sure that your environment includes zone.js/dist/zone-testing.js"
        ],
        "trace": [
            "Error: zone-testing.js is needed for the fakeAsync() test helper but could not be found.\n        Please make sure that your environment includes zone.js/dist/zone-testing.js\n    at resetFakeAsyncZone (D:\\Proyectos\\ADNCeiba\\packages\\core\\testing\\src\\fake_async.ts:25:9)\n    at UserContext.<anonymous> (D:\\Proyectos\\ADNCeiba\\packages\\core\\testing\\src\\before_each.ts:26:5)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\nFrom: Task: Run beforeEach in control flow\n    at UserContext.<anonymous> (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at QueueRunner.execute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4199:10)\n    at Spec.queueRunnerFactory (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:909:35)\n    at Spec.execute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:526:10)\n    at UserContext.fn (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:5340:37)\n    at attempt (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at QueueRunner.execute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4199:10)\nFrom asynchronous test: \nError: \n    at D:\\Proyectos\\ADNCeiba\\packages\\core\\testing\\src\\before_each.ts:24:11\n    at D:\\Proyectos\\ADNCeiba\\angular-base\\node_modules\\@angular\\core\\bundles\\core-testing.umd.js:8:68\n    at Object.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\node_modules\\@angular\\core\\bundles\\core-testing.umd.js:11:2)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Module.load (internal/modules/cjs/loader.js:928:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:769:14)\n    at Module.require (internal/modules/cjs/loader.js:952:19)\n    at require (internal/modules/cjs/helpers.js:88:18)",
            "Error: zone-testing.js is needed for the fakeAsync() test helper but could not be found.\n        Please make sure that your environment includes zone.js/dist/zone-testing.js\n    at Object.fakeAsync (D:\\Proyectos\\ADNCeiba\\packages\\core\\testing\\src\\fake_async.ts:51:9)\n    at Suite.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\test\\libro.e2e-spec.ts:12:52)\n    at addSpecsToSuite (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\test\\libro.e2e-spec.ts:5:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Module.m._compile (D:\\Proyectos\\ADNCeiba\\angular-base\\node_modules\\ts-node\\src\\index.ts:439:23)\n    at Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Object.require.extensions.<computed> [as .ts] (D:\\Proyectos\\ADNCeiba\\angular-base\\node_modules\\ts-node\\src\\index.ts:442:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "00a50021-00d7-00d9-00ae-004e00ef0098.png",
        "timestamp": 1616011730420,
        "duration": 5
    },
    {
        "description": "deber??a mostrar mensaje error email obligatorio|work-space project login",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 20396,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: zone-testing.js is needed for the fakeAsync() test helper but could not be found.\n        Please make sure that your environment includes zone.js/dist/zone-testing.js"
        ],
        "trace": [
            "Error: zone-testing.js is needed for the fakeAsync() test helper but could not be found.\n        Please make sure that your environment includes zone.js/dist/zone-testing.js\n    at resetFakeAsyncZone (D:\\Proyectos\\ADNCeiba\\packages\\core\\testing\\src\\fake_async.ts:25:9)\n    at UserContext.<anonymous> (D:\\Proyectos\\ADNCeiba\\packages\\core\\testing\\src\\before_each.ts:26:5)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\nFrom: Task: Run beforeEach in control flow\n    at UserContext.<anonymous> (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at QueueRunner.execute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4199:10)\n    at Spec.queueRunnerFactory (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:909:35)\n    at Spec.execute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:526:10)\n    at UserContext.fn (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:5340:37)\n    at attempt (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at QueueRunner.execute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4199:10)\nFrom asynchronous test: \nError: \n    at D:\\Proyectos\\ADNCeiba\\packages\\core\\testing\\src\\before_each.ts:24:11\n    at D:\\Proyectos\\ADNCeiba\\angular-base\\node_modules\\@angular\\core\\bundles\\core-testing.umd.js:8:68\n    at Object.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\node_modules\\@angular\\core\\bundles\\core-testing.umd.js:11:2)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Module.load (internal/modules/cjs/loader.js:928:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:769:14)\n    at Module.require (internal/modules/cjs/loader.js:952:19)\n    at require (internal/modules/cjs/helpers.js:88:18)"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616011731809,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616011731809,
                "type": ""
            }
        ],
        "screenShotFile": "00b50062-001a-00e7-0089-0079008000e8.png",
        "timestamp": 1616011730725,
        "duration": 1080
    },
    {
        "description": "deber??a mostrar mensaje error email no valido|work-space project login",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 20396,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: zone-testing.js is needed for the fakeAsync() test helper but could not be found.\n        Please make sure that your environment includes zone.js/dist/zone-testing.js"
        ],
        "trace": [
            "Error: zone-testing.js is needed for the fakeAsync() test helper but could not be found.\n        Please make sure that your environment includes zone.js/dist/zone-testing.js\n    at resetFakeAsyncZone (D:\\Proyectos\\ADNCeiba\\packages\\core\\testing\\src\\fake_async.ts:25:9)\n    at UserContext.<anonymous> (D:\\Proyectos\\ADNCeiba\\packages\\core\\testing\\src\\before_each.ts:26:5)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\nFrom: Task: Run beforeEach in control flow\n    at UserContext.<anonymous> (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at QueueRunner.execute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4199:10)\n    at Spec.queueRunnerFactory (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:909:35)\n    at Spec.execute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:526:10)\n    at UserContext.fn (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:5340:37)\n    at attempt (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\nFrom asynchronous test: \nError: \n    at D:\\Proyectos\\ADNCeiba\\packages\\core\\testing\\src\\before_each.ts:24:11\n    at D:\\Proyectos\\ADNCeiba\\angular-base\\node_modules\\@angular\\core\\bundles\\core-testing.umd.js:8:68\n    at Object.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\node_modules\\@angular\\core\\bundles\\core-testing.umd.js:11:2)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Module.load (internal/modules/cjs/loader.js:928:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:769:14)\n    at Module.require (internal/modules/cjs/loader.js:952:19)\n    at require (internal/modules/cjs/helpers.js:88:18)"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616011733019,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616011733020,
                "type": ""
            }
        ],
        "screenShotFile": "00990023-00d6-008d-00e6-00ab00210004.png",
        "timestamp": 1616011732126,
        "duration": 988
    },
    {
        "description": "muestra mensaje error password obligatorio|work-space project login",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 20396,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: zone-testing.js is needed for the fakeAsync() test helper but could not be found.\n        Please make sure that your environment includes zone.js/dist/zone-testing.js"
        ],
        "trace": [
            "Error: zone-testing.js is needed for the fakeAsync() test helper but could not be found.\n        Please make sure that your environment includes zone.js/dist/zone-testing.js\n    at resetFakeAsyncZone (D:\\Proyectos\\ADNCeiba\\packages\\core\\testing\\src\\fake_async.ts:25:9)\n    at UserContext.<anonymous> (D:\\Proyectos\\ADNCeiba\\packages\\core\\testing\\src\\before_each.ts:26:5)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\nFrom: Task: Run beforeEach in control flow\n    at UserContext.<anonymous> (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at QueueRunner.execute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4199:10)\n    at Spec.queueRunnerFactory (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:909:35)\n    at Spec.execute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:526:10)\n    at UserContext.fn (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:5340:37)\n    at attempt (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\nFrom asynchronous test: \nError: \n    at D:\\Proyectos\\ADNCeiba\\packages\\core\\testing\\src\\before_each.ts:24:11\n    at D:\\Proyectos\\ADNCeiba\\angular-base\\node_modules\\@angular\\core\\bundles\\core-testing.umd.js:8:68\n    at Object.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\node_modules\\@angular\\core\\bundles\\core-testing.umd.js:11:2)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Module.load (internal/modules/cjs/loader.js:928:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:769:14)\n    at Module.require (internal/modules/cjs/loader.js:952:19)\n    at require (internal/modules/cjs/helpers.js:88:18)"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616011734550,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616011734551,
                "type": ""
            }
        ],
        "screenShotFile": "004b00e2-007f-0049-004f-00c30069003f.png",
        "timestamp": 1616011733449,
        "duration": 1217
    },
    {
        "description": "redirecciona a la p??gina de home si login es valido|work-space project login",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 20396,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: zone-testing.js is needed for the fakeAsync() test helper but could not be found.\n        Please make sure that your environment includes zone.js/dist/zone-testing.js"
        ],
        "trace": [
            "Error: zone-testing.js is needed for the fakeAsync() test helper but could not be found.\n        Please make sure that your environment includes zone.js/dist/zone-testing.js\n    at resetFakeAsyncZone (D:\\Proyectos\\ADNCeiba\\packages\\core\\testing\\src\\fake_async.ts:25:9)\n    at UserContext.<anonymous> (D:\\Proyectos\\ADNCeiba\\packages\\core\\testing\\src\\before_each.ts:26:5)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\nFrom: Task: Run beforeEach in control flow\n    at UserContext.<anonymous> (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at QueueRunner.execute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4199:10)\n    at Spec.queueRunnerFactory (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:909:35)\n    at Spec.execute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:526:10)\n    at UserContext.fn (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:5340:37)\n    at attempt (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\nFrom asynchronous test: \nError: \n    at D:\\Proyectos\\ADNCeiba\\packages\\core\\testing\\src\\before_each.ts:24:11\n    at D:\\Proyectos\\ADNCeiba\\angular-base\\node_modules\\@angular\\core\\bundles\\core-testing.umd.js:8:68\n    at Object.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\node_modules\\@angular\\core\\bundles\\core-testing.umd.js:11:2)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Module.load (internal/modules/cjs/loader.js:928:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:769:14)\n    at Module.require (internal/modules/cjs/loader.js:952:19)\n    at require (internal/modules/cjs/helpers.js:88:18)"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616011735948,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616011735948,
                "type": ""
            }
        ],
        "screenShotFile": "00140028-00ea-0094-003d-000e00ac0044.png",
        "timestamp": 1616011734982,
        "duration": 2056
    },
    {
        "description": "encountered a declaration exception|workspace-project Prestamo",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 20396,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: zone-testing.js is needed for the fakeAsync() test helper but could not be found.\n        Please make sure that your environment includes zone.js/dist/zone-testing.js",
            "Error: zone-testing.js is needed for the fakeAsync() test helper but could not be found.\n        Please make sure that your environment includes zone.js/dist/zone-testing.js"
        ],
        "trace": [
            "Error: zone-testing.js is needed for the fakeAsync() test helper but could not be found.\n        Please make sure that your environment includes zone.js/dist/zone-testing.js\n    at resetFakeAsyncZone (D:\\Proyectos\\ADNCeiba\\packages\\core\\testing\\src\\fake_async.ts:25:9)\n    at UserContext.<anonymous> (D:\\Proyectos\\ADNCeiba\\packages\\core\\testing\\src\\before_each.ts:26:5)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\nFrom: Task: Run beforeEach in control flow\n    at UserContext.<anonymous> (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at QueueRunner.execute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4199:10)\n    at Spec.queueRunnerFactory (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:909:35)\n    at Spec.execute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:526:10)\n    at UserContext.fn (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:5340:37)\n    at attempt (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at QueueRunner.execute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4199:10)\nFrom asynchronous test: \nError: \n    at D:\\Proyectos\\ADNCeiba\\packages\\core\\testing\\src\\before_each.ts:24:11\n    at D:\\Proyectos\\ADNCeiba\\angular-base\\node_modules\\@angular\\core\\bundles\\core-testing.umd.js:8:68\n    at Object.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\node_modules\\@angular\\core\\bundles\\core-testing.umd.js:11:2)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Module.load (internal/modules/cjs/loader.js:928:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:769:14)\n    at Module.require (internal/modules/cjs/loader.js:952:19)\n    at require (internal/modules/cjs/helpers.js:88:18)",
            "Error: zone-testing.js is needed for the fakeAsync() test helper but could not be found.\n        Please make sure that your environment includes zone.js/dist/zone-testing.js\n    at Object.fakeAsync (D:\\Proyectos\\ADNCeiba\\packages\\core\\testing\\src\\fake_async.ts:51:9)\n    at Suite.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\test\\prestamo.e2e-spec.ts:14:48)\n    at addSpecsToSuite (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\test\\prestamo.e2e-spec.ts:7:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Module.m._compile (D:\\Proyectos\\ADNCeiba\\angular-base\\node_modules\\ts-node\\src\\index.ts:439:23)\n    at Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Object.require.extensions.<computed> [as .ts] (D:\\Proyectos\\ADNCeiba\\angular-base\\node_modules\\ts-node\\src\\index.ts:442:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "00fb0054-00a2-004b-00ca-0094001b00af.png",
        "timestamp": 1616011737335,
        "duration": 9
    },
    {
        "description": "encountered a declaration exception|workspace-project App",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 9088,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: zone-testing.js is needed for the fakeAsync() test helper but could not be found.\n        Please make sure that your environment includes zone.js/dist/zone-testing.js",
            "Error: zone-testing.js is needed for the fakeAsync() test helper but could not be found.\n        Please make sure that your environment includes zone.js/dist/zone-testing.js"
        ],
        "trace": [
            "Error: zone-testing.js is needed for the fakeAsync() test helper but could not be found.\n        Please make sure that your environment includes zone.js/dist/zone-testing.js\n    at resetFakeAsyncZone (D:\\Proyectos\\ADNCeiba\\packages\\core\\testing\\src\\fake_async.ts:25:9)\n    at UserContext.<anonymous> (D:\\Proyectos\\ADNCeiba\\packages\\core\\testing\\src\\before_each.ts:26:5)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\nFrom: Task: Run beforeEach in control flow\n    at UserContext.<anonymous> (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at QueueRunner.execute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4199:10)\n    at Spec.queueRunnerFactory (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:909:35)\n    at Spec.execute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:526:10)\n    at UserContext.fn (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:5340:37)\n    at attempt (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at QueueRunner.execute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4199:10)\nFrom asynchronous test: \nError: \n    at D:\\Proyectos\\ADNCeiba\\packages\\core\\testing\\src\\before_each.ts:24:11\n    at D:\\Proyectos\\ADNCeiba\\angular-base\\node_modules\\@angular\\core\\bundles\\core-testing.umd.js:8:68\n    at Object.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\node_modules\\@angular\\core\\bundles\\core-testing.umd.js:11:2)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Module.load (internal/modules/cjs/loader.js:928:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:769:14)\n    at Module.require (internal/modules/cjs/loader.js:952:19)\n    at require (internal/modules/cjs/helpers.js:88:18)",
            "Error: zone-testing.js is needed for the fakeAsync() test helper but could not be found.\n        Please make sure that your environment includes zone.js/dist/zone-testing.js\n    at Object.fakeAsync (D:\\Proyectos\\ADNCeiba\\packages\\core\\testing\\src\\fake_async.ts:51:9)\n    at Suite.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\app.e2e-spec.ts:12:41)\n    at addSpecsToSuite (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\app.e2e-spec.ts:5:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Module.m._compile (D:\\Proyectos\\ADNCeiba\\angular-base\\node_modules\\ts-node\\src\\index.ts:439:23)\n    at Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Object.require.extensions.<computed> [as .ts] (D:\\Proyectos\\ADNCeiba\\angular-base\\node_modules\\ts-node\\src\\index.ts:442:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "009200f2-00f5-00e5-00ab-000800d100f6.png",
        "timestamp": 1616012022240,
        "duration": 9
    },
    {
        "description": "encountered a declaration exception|work-space project libro",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 9088,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: zone-testing.js is needed for the fakeAsync() test helper but could not be found.\n        Please make sure that your environment includes zone.js/dist/zone-testing.js",
            "Error: zone-testing.js is needed for the fakeAsync() test helper but could not be found.\n        Please make sure that your environment includes zone.js/dist/zone-testing.js"
        ],
        "trace": [
            "Error: zone-testing.js is needed for the fakeAsync() test helper but could not be found.\n        Please make sure that your environment includes zone.js/dist/zone-testing.js\n    at resetFakeAsyncZone (D:\\Proyectos\\ADNCeiba\\packages\\core\\testing\\src\\fake_async.ts:25:9)\n    at UserContext.<anonymous> (D:\\Proyectos\\ADNCeiba\\packages\\core\\testing\\src\\before_each.ts:26:5)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\nFrom: Task: Run beforeEach in control flow\n    at UserContext.<anonymous> (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at QueueRunner.execute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4199:10)\n    at Spec.queueRunnerFactory (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:909:35)\n    at Spec.execute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:526:10)\n    at UserContext.fn (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:5340:37)\n    at attempt (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at QueueRunner.execute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4199:10)\nFrom asynchronous test: \nError: \n    at D:\\Proyectos\\ADNCeiba\\packages\\core\\testing\\src\\before_each.ts:24:11\n    at D:\\Proyectos\\ADNCeiba\\angular-base\\node_modules\\@angular\\core\\bundles\\core-testing.umd.js:8:68\n    at Object.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\node_modules\\@angular\\core\\bundles\\core-testing.umd.js:11:2)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Module.load (internal/modules/cjs/loader.js:928:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:769:14)\n    at Module.require (internal/modules/cjs/loader.js:952:19)\n    at require (internal/modules/cjs/helpers.js:88:18)",
            "Error: zone-testing.js is needed for the fakeAsync() test helper but could not be found.\n        Please make sure that your environment includes zone.js/dist/zone-testing.js\n    at Object.fakeAsync (D:\\Proyectos\\ADNCeiba\\packages\\core\\testing\\src\\fake_async.ts:51:9)\n    at Suite.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\test\\libro.e2e-spec.ts:12:52)\n    at addSpecsToSuite (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\test\\libro.e2e-spec.ts:5:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Module.m._compile (D:\\Proyectos\\ADNCeiba\\angular-base\\node_modules\\ts-node\\src\\index.ts:439:23)\n    at Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Object.require.extensions.<computed> [as .ts] (D:\\Proyectos\\ADNCeiba\\angular-base\\node_modules\\ts-node\\src\\index.ts:442:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "0054000d-009a-00ea-0002-00fd00fd0077.png",
        "timestamp": 1616012022743,
        "duration": 8
    },
    {
        "description": "deber??a mostrar mensaje error email obligatorio|work-space project login",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 9088,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: zone-testing.js is needed for the fakeAsync() test helper but could not be found.\n        Please make sure that your environment includes zone.js/dist/zone-testing.js"
        ],
        "trace": [
            "Error: zone-testing.js is needed for the fakeAsync() test helper but could not be found.\n        Please make sure that your environment includes zone.js/dist/zone-testing.js\n    at resetFakeAsyncZone (D:\\Proyectos\\ADNCeiba\\packages\\core\\testing\\src\\fake_async.ts:25:9)\n    at UserContext.<anonymous> (D:\\Proyectos\\ADNCeiba\\packages\\core\\testing\\src\\before_each.ts:26:5)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\nFrom: Task: Run beforeEach in control flow\n    at UserContext.<anonymous> (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at QueueRunner.execute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4199:10)\n    at Spec.queueRunnerFactory (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:909:35)\n    at Spec.execute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:526:10)\n    at UserContext.fn (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:5340:37)\n    at attempt (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at QueueRunner.execute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4199:10)\nFrom asynchronous test: \nError: \n    at D:\\Proyectos\\ADNCeiba\\packages\\core\\testing\\src\\before_each.ts:24:11\n    at D:\\Proyectos\\ADNCeiba\\angular-base\\node_modules\\@angular\\core\\bundles\\core-testing.umd.js:8:68\n    at Object.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\node_modules\\@angular\\core\\bundles\\core-testing.umd.js:11:2)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Module.load (internal/modules/cjs/loader.js:928:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:769:14)\n    at Module.require (internal/modules/cjs/loader.js:952:19)\n    at require (internal/modules/cjs/helpers.js:88:18)"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616012024065,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616012024065,
                "type": ""
            }
        ],
        "screenShotFile": "0064009c-00e5-005a-00c3-00cc009700bc.png",
        "timestamp": 1616012023052,
        "duration": 1099
    },
    {
        "description": "deber??a mostrar mensaje error email no valido|work-space project login",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 9088,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: zone-testing.js is needed for the fakeAsync() test helper but could not be found.\n        Please make sure that your environment includes zone.js/dist/zone-testing.js"
        ],
        "trace": [
            "Error: zone-testing.js is needed for the fakeAsync() test helper but could not be found.\n        Please make sure that your environment includes zone.js/dist/zone-testing.js\n    at resetFakeAsyncZone (D:\\Proyectos\\ADNCeiba\\packages\\core\\testing\\src\\fake_async.ts:25:9)\n    at UserContext.<anonymous> (D:\\Proyectos\\ADNCeiba\\packages\\core\\testing\\src\\before_each.ts:26:5)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\nFrom: Task: Run beforeEach in control flow\n    at UserContext.<anonymous> (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at QueueRunner.execute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4199:10)\n    at Spec.queueRunnerFactory (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:909:35)\n    at Spec.execute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:526:10)\n    at UserContext.fn (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:5340:37)\n    at attempt (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\nFrom asynchronous test: \nError: \n    at D:\\Proyectos\\ADNCeiba\\packages\\core\\testing\\src\\before_each.ts:24:11\n    at D:\\Proyectos\\ADNCeiba\\angular-base\\node_modules\\@angular\\core\\bundles\\core-testing.umd.js:8:68\n    at Object.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\node_modules\\@angular\\core\\bundles\\core-testing.umd.js:11:2)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Module.load (internal/modules/cjs/loader.js:928:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:769:14)\n    at Module.require (internal/modules/cjs/loader.js:952:19)\n    at require (internal/modules/cjs/helpers.js:88:18)"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616012025327,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616012025327,
                "type": ""
            }
        ],
        "screenShotFile": "00eb0072-00c6-005d-00b3-00d300a600cf.png",
        "timestamp": 1616012024483,
        "duration": 983
    },
    {
        "description": "muestra mensaje error password obligatorio|work-space project login",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 9088,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: zone-testing.js is needed for the fakeAsync() test helper but could not be found.\n        Please make sure that your environment includes zone.js/dist/zone-testing.js"
        ],
        "trace": [
            "Error: zone-testing.js is needed for the fakeAsync() test helper but could not be found.\n        Please make sure that your environment includes zone.js/dist/zone-testing.js\n    at resetFakeAsyncZone (D:\\Proyectos\\ADNCeiba\\packages\\core\\testing\\src\\fake_async.ts:25:9)\n    at UserContext.<anonymous> (D:\\Proyectos\\ADNCeiba\\packages\\core\\testing\\src\\before_each.ts:26:5)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\nFrom: Task: Run beforeEach in control flow\n    at UserContext.<anonymous> (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at QueueRunner.execute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4199:10)\n    at Spec.queueRunnerFactory (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:909:35)\n    at Spec.execute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:526:10)\n    at UserContext.fn (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:5340:37)\n    at attempt (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\nFrom asynchronous test: \nError: \n    at D:\\Proyectos\\ADNCeiba\\packages\\core\\testing\\src\\before_each.ts:24:11\n    at D:\\Proyectos\\ADNCeiba\\angular-base\\node_modules\\@angular\\core\\bundles\\core-testing.umd.js:8:68\n    at Object.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\node_modules\\@angular\\core\\bundles\\core-testing.umd.js:11:2)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Module.load (internal/modules/cjs/loader.js:928:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:769:14)\n    at Module.require (internal/modules/cjs/loader.js:952:19)\n    at require (internal/modules/cjs/helpers.js:88:18)"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616012026601,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616012026602,
                "type": ""
            }
        ],
        "screenShotFile": "008500be-00e3-00ee-0060-003900a60096.png",
        "timestamp": 1616012025786,
        "duration": 911
    },
    {
        "description": "redirecciona a la p??gina de home si login es valido|work-space project login",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 9088,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: zone-testing.js is needed for the fakeAsync() test helper but could not be found.\n        Please make sure that your environment includes zone.js/dist/zone-testing.js"
        ],
        "trace": [
            "Error: zone-testing.js is needed for the fakeAsync() test helper but could not be found.\n        Please make sure that your environment includes zone.js/dist/zone-testing.js\n    at resetFakeAsyncZone (D:\\Proyectos\\ADNCeiba\\packages\\core\\testing\\src\\fake_async.ts:25:9)\n    at UserContext.<anonymous> (D:\\Proyectos\\ADNCeiba\\packages\\core\\testing\\src\\before_each.ts:26:5)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\nFrom: Task: Run beforeEach in control flow\n    at UserContext.<anonymous> (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at QueueRunner.execute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4199:10)\n    at Spec.queueRunnerFactory (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:909:35)\n    at Spec.execute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:526:10)\n    at UserContext.fn (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:5340:37)\n    at attempt (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\nFrom asynchronous test: \nError: \n    at D:\\Proyectos\\ADNCeiba\\packages\\core\\testing\\src\\before_each.ts:24:11\n    at D:\\Proyectos\\ADNCeiba\\angular-base\\node_modules\\@angular\\core\\bundles\\core-testing.umd.js:8:68\n    at Object.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\node_modules\\@angular\\core\\bundles\\core-testing.umd.js:11:2)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Module.load (internal/modules/cjs/loader.js:928:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:769:14)\n    at Module.require (internal/modules/cjs/loader.js:952:19)\n    at require (internal/modules/cjs/helpers.js:88:18)"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616012027900,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616012027900,
                "type": ""
            }
        ],
        "screenShotFile": "00280060-0045-00ab-0016-00f8006d001e.png",
        "timestamp": 1616012027062,
        "duration": 2045
    },
    {
        "description": "encountered a declaration exception|workspace-project Prestamo",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 9088,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: zone-testing.js is needed for the fakeAsync() test helper but could not be found.\n        Please make sure that your environment includes zone.js/dist/zone-testing.js",
            "Error: zone-testing.js is needed for the fakeAsync() test helper but could not be found.\n        Please make sure that your environment includes zone.js/dist/zone-testing.js"
        ],
        "trace": [
            "Error: zone-testing.js is needed for the fakeAsync() test helper but could not be found.\n        Please make sure that your environment includes zone.js/dist/zone-testing.js\n    at resetFakeAsyncZone (D:\\Proyectos\\ADNCeiba\\packages\\core\\testing\\src\\fake_async.ts:25:9)\n    at UserContext.<anonymous> (D:\\Proyectos\\ADNCeiba\\packages\\core\\testing\\src\\before_each.ts:26:5)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\nFrom: Task: Run beforeEach in control flow\n    at UserContext.<anonymous> (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at QueueRunner.execute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4199:10)\n    at Spec.queueRunnerFactory (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:909:35)\n    at Spec.execute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:526:10)\n    at UserContext.fn (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:5340:37)\n    at attempt (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at QueueRunner.execute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4199:10)\nFrom asynchronous test: \nError: \n    at D:\\Proyectos\\ADNCeiba\\packages\\core\\testing\\src\\before_each.ts:24:11\n    at D:\\Proyectos\\ADNCeiba\\angular-base\\node_modules\\@angular\\core\\bundles\\core-testing.umd.js:8:68\n    at Object.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\node_modules\\@angular\\core\\bundles\\core-testing.umd.js:11:2)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Module.load (internal/modules/cjs/loader.js:928:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:769:14)\n    at Module.require (internal/modules/cjs/loader.js:952:19)\n    at require (internal/modules/cjs/helpers.js:88:18)",
            "Error: zone-testing.js is needed for the fakeAsync() test helper but could not be found.\n        Please make sure that your environment includes zone.js/dist/zone-testing.js\n    at Object.fakeAsync (D:\\Proyectos\\ADNCeiba\\packages\\core\\testing\\src\\fake_async.ts:51:9)\n    at Suite.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\test\\prestamo.e2e-spec.ts:14:48)\n    at addSpecsToSuite (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\test\\prestamo.e2e-spec.ts:7:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Module.m._compile (D:\\Proyectos\\ADNCeiba\\angular-base\\node_modules\\ts-node\\src\\index.ts:439:23)\n    at Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Object.require.extensions.<computed> [as .ts] (D:\\Proyectos\\ADNCeiba\\angular-base\\node_modules\\ts-node\\src\\index.ts:442:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "00b600af-00c7-00f8-00d4-00700075004c.png",
        "timestamp": 1616012029441,
        "duration": 4
    },
    {
        "description": "deber??a mostrar p??gina de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3436,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00730031-0095-0079-003d-0084004f00fd.png",
        "timestamp": 1616012107563,
        "duration": 913
    },
    {
        "description": "Muestra mensajes error campos obligatorios|work-space project libro",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3436,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00590050-00ce-009e-00de-00b300750022.png",
        "timestamp": 1616012108957,
        "duration": 812
    },
    {
        "description": "Muestra mensaje error nombre obligatorio|work-space project libro",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3436,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "000800fa-00b6-003e-004a-001800fc0072.png",
        "timestamp": 1616012110075,
        "duration": 848
    },
    {
        "description": "deber??a mostrar mensaje error email obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3436,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616012112060,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616012112061,
                "type": ""
            }
        ],
        "screenShotFile": "00880008-0009-00e5-009f-007700590098.png",
        "timestamp": 1616012111228,
        "duration": 935
    },
    {
        "description": "deber??a mostrar mensaje error email no valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3436,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616012113414,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616012113414,
                "type": ""
            }
        ],
        "screenShotFile": "00db00ef-0009-00e5-0019-00670009000e.png",
        "timestamp": 1616012112567,
        "duration": 887
    },
    {
        "description": "muestra mensaje error password obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3436,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00c3000d-0012-0052-00df-00b500150029.png",
        "timestamp": 1616012113810,
        "duration": 854
    },
    {
        "description": "redirecciona a la p??gina de home si login es valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3436,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616012114669,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616012114669,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616012115801,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616012115801,
                "type": ""
            }
        ],
        "screenShotFile": "002d00a2-0084-00e0-003f-00cf006e0076.png",
        "timestamp": 1616012114986,
        "duration": 1738
    },
    {
        "description": "Muestra mensaje error ISBN obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3436,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616012117826,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616012117826,
                "type": ""
            }
        ],
        "screenShotFile": "00b700ce-0010-00ee-0069-00b60039005a.png",
        "timestamp": 1616012117070,
        "duration": 1032
    },
    {
        "description": "Muestra mensaje error Nombre obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3436,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616012119145,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616012119145,
                "type": ""
            }
        ],
        "screenShotFile": "000b0069-0041-007d-0027-0096007a0083.png",
        "timestamp": 1616012118432,
        "duration": 963
    },
    {
        "description": "deber??a mostrar p??gina de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 14408,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "009e0048-0020-00bb-0021-009600ca001e.png",
        "timestamp": 1616012139069,
        "duration": 914
    },
    {
        "description": "Muestra mensajes error campos obligatorios|work-space project libro",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 14408,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0088000f-0082-0088-0025-00590049004f.png",
        "timestamp": 1616012140477,
        "duration": 669
    },
    {
        "description": "deber??a mostrar mensaje error email obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 14408,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616012141279,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616012141280,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616012142396,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616012142397,
                "type": ""
            }
        ],
        "screenShotFile": "0028008d-0040-005a-0043-00d60080002e.png",
        "timestamp": 1616012141499,
        "duration": 931
    },
    {
        "description": "deber??a mostrar mensaje error email no valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 14408,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616012143618,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616012143619,
                "type": ""
            }
        ],
        "screenShotFile": "006000d4-00d8-0057-00d7-00b900070073.png",
        "timestamp": 1616012142764,
        "duration": 1017
    },
    {
        "description": "muestra mensaje error password obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 14408,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616012144967,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616012144968,
                "type": ""
            }
        ],
        "screenShotFile": "00bc0059-0030-004d-0040-0059002300b3.png",
        "timestamp": 1616012144099,
        "duration": 899
    },
    {
        "description": "redirecciona a la p??gina de home si login es valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 14408,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616012146198,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616012146198,
                "type": ""
            }
        ],
        "screenShotFile": "004c006f-00d1-006a-0038-0016005c0073.png",
        "timestamp": 1616012145333,
        "duration": 1876
    },
    {
        "description": "Muestra mensaje error ISBN obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 14408,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616012148322,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616012148322,
                "type": ""
            }
        ],
        "screenShotFile": "00e0007b-00a4-0072-009f-00a500c400fc.png",
        "timestamp": 1616012147513,
        "duration": 850
    },
    {
        "description": "Muestra mensaje error Nombre obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 14408,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616012149453,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616012149454,
                "type": ""
            }
        ],
        "screenShotFile": "001b00ad-0031-006f-00d4-00b900750097.png",
        "timestamp": 1616012148702,
        "duration": 906
    },
    {
        "description": "deber??a mostrar p??gina de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 1996,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "006a0092-0045-007f-00a0-00fe00240074.png",
        "timestamp": 1616012807149,
        "duration": 970
    },
    {
        "description": "deber??a mostrar mensaje error email obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 1996,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616012808165,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616012808166,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616012809477,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616012809477,
                "type": ""
            }
        ],
        "screenShotFile": "002100b9-005f-005d-0068-000600cb0074.png",
        "timestamp": 1616012808664,
        "duration": 957
    },
    {
        "description": "deber??a mostrar mensaje error email no valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 1996,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616012810759,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616012810759,
                "type": ""
            }
        ],
        "screenShotFile": "00a500ba-002f-0094-0047-0078006600fc.png",
        "timestamp": 1616012809974,
        "duration": 1068
    },
    {
        "description": "muestra mensaje error password obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 1996,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616012812225,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616012812226,
                "type": ""
            }
        ],
        "screenShotFile": "00ff0022-00d6-00a1-0026-007300e40021.png",
        "timestamp": 1616012811366,
        "duration": 925
    },
    {
        "description": "redirecciona a la p??gina de home si login es valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 1996,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616012813455,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616012813455,
                "type": ""
            }
        ],
        "screenShotFile": "003f00e1-009d-00a2-0046-00e500820088.png",
        "timestamp": 1616012812607,
        "duration": 2114
    },
    {
        "description": "Muestra mensaje error ISBN obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 1996,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616012815809,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616012815809,
                "type": ""
            }
        ],
        "screenShotFile": "003000d4-0048-0029-004d-00b300a800f0.png",
        "timestamp": 1616012815012,
        "duration": 986
    },
    {
        "description": "Muestra mensaje error Nombre obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 1996,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616012817070,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616012817070,
                "type": ""
            }
        ],
        "screenShotFile": "002b0096-0075-00ef-0035-00e2007d003f.png",
        "timestamp": 1616012816321,
        "duration": 953
    },
    {
        "description": "deber??a mostrar p??gina de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 12112,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00aa0031-003e-0082-009f-00ac000a0026.png",
        "timestamp": 1616013794229,
        "duration": 951
    },
    {
        "description": "Muestra mensajes error campos obligatorios|work-space project libro",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 12112,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00cc00cc-00a2-00dc-00bf-005c001300bd.png",
        "timestamp": 1616013795729,
        "duration": 758
    },
    {
        "description": "deber??a mostrar mensaje error email obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 12112,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616013796509,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616013796510,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616013797607,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616013797607,
                "type": ""
            }
        ],
        "screenShotFile": "00dc006e-00b0-0031-00b3-007a00330049.png",
        "timestamp": 1616013796827,
        "duration": 911
    },
    {
        "description": "deber??a mostrar mensaje error email no valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 12112,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616013798874,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616013798875,
                "type": ""
            }
        ],
        "screenShotFile": "003600d6-0034-00ca-009c-00dd009a006a.png",
        "timestamp": 1616013798085,
        "duration": 1003
    },
    {
        "description": "muestra mensaje error password obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 12112,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616013800339,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616013800339,
                "type": ""
            }
        ],
        "screenShotFile": "0053004a-00b0-0046-001f-00bc002300dd.png",
        "timestamp": 1616013799466,
        "duration": 979
    },
    {
        "description": "redirecciona a la p??gina de home si login es valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 12112,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616013801570,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616013801571,
                "type": ""
            }
        ],
        "screenShotFile": "00e1002f-00e8-000c-00c8-0010009d001b.png",
        "timestamp": 1616013800778,
        "duration": 1892
    },
    {
        "description": "Muestra mensaje error ISBN obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 12112,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616013803773,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616013803773,
                "type": ""
            }
        ],
        "screenShotFile": "005d0089-0094-0019-00d8-00660055009f.png",
        "timestamp": 1616013802960,
        "duration": 1009
    },
    {
        "description": "Muestra mensaje error Nombre obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 12112,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616013805015,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616013805015,
                "type": ""
            }
        ],
        "screenShotFile": "003f006a-0075-00c8-005f-00f5006500d1.png",
        "timestamp": 1616013804285,
        "duration": 894
    },
    {
        "description": "deber??a mostrar p??gina de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 7320,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0047008f-008c-00b5-001d-00a000e900d5.png",
        "timestamp": 1616013941520,
        "duration": 972
    },
    {
        "description": "Muestra mensajes error campos obligatorios|work-space project libro",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 7320,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "000c00df-004a-0016-000a-007c00ed00ce.png",
        "timestamp": 1616013942988,
        "duration": 742
    },
    {
        "description": "deber??a mostrar mensaje error email obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 7320,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616013943831,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616013943832,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616013944885,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616013944885,
                "type": ""
            }
        ],
        "screenShotFile": "001a0005-008d-0036-0037-00bd00a500b2.png",
        "timestamp": 1616013944054,
        "duration": 905
    },
    {
        "description": "deber??a mostrar mensaje error email no valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 7320,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616013946130,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616013946131,
                "type": ""
            }
        ],
        "screenShotFile": "001000fc-00ab-00af-0034-002600f20029.png",
        "timestamp": 1616013945286,
        "duration": 983
    },
    {
        "description": "muestra mensaje error password obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 7320,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616013947460,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616013947460,
                "type": ""
            }
        ],
        "screenShotFile": "003d00a4-009d-00d7-00d5-00fa0007004c.png",
        "timestamp": 1616013946603,
        "duration": 920
    },
    {
        "description": "redirecciona a la p??gina de home si login es valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 7320,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616013948614,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616013948615,
                "type": ""
            }
        ],
        "screenShotFile": "0053002d-005f-00f1-001c-003200d1001e.png",
        "timestamp": 1616013947825,
        "duration": 1932
    },
    {
        "description": "Muestra mensaje error ISBN obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 7320,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616013950832,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616013950833,
                "type": ""
            }
        ],
        "screenShotFile": "00960012-0028-00d4-0041-008700480022.png",
        "timestamp": 1616013950120,
        "duration": 915
    },
    {
        "description": "Muestra mensaje error Nombre obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 7320,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616013952184,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616013952184,
                "type": ""
            }
        ],
        "screenShotFile": "00810099-0098-006c-00ef-006e00ea0094.png",
        "timestamp": 1616013951376,
        "duration": 972
    },
    {
        "description": "deber??a mostrar p??gina de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9188,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00f100e3-00b4-0048-0032-000900b8002d.png",
        "timestamp": 1616013993353,
        "duration": 880
    },
    {
        "description": "Muestra mensajes error campos obligatorios|work-space project libro",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9188,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "009300c7-0088-002f-003a-00c900970034.png",
        "timestamp": 1616013994733,
        "duration": 697
    },
    {
        "description": "deber??a mostrar mensaje error email obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9188,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616013995544,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616013995544,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616013996544,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616013996545,
                "type": ""
            }
        ],
        "screenShotFile": "000f006b-002b-0000-0022-00360099001c.png",
        "timestamp": 1616013995728,
        "duration": 882
    },
    {
        "description": "deber??a mostrar mensaje error email no valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9188,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616013997771,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616013997772,
                "type": ""
            }
        ],
        "screenShotFile": "006e00a6-00d9-00d9-00da-0027007a00e1.png",
        "timestamp": 1616013996984,
        "duration": 993
    },
    {
        "description": "muestra mensaje error password obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9188,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "005a0067-000f-0028-0021-0006006300f7.png",
        "timestamp": 1616013998345,
        "duration": 788
    },
    {
        "description": "redirecciona a la p??gina de home si login es valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9188,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616013999156,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616013999156,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616014000281,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616014000281,
                "type": ""
            }
        ],
        "screenShotFile": "008e00f6-003b-0031-00bb-006900b600f1.png",
        "timestamp": 1616013999436,
        "duration": 1916
    },
    {
        "description": "Muestra mensaje error ISBN obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9188,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616014002405,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616014002406,
                "type": ""
            }
        ],
        "screenShotFile": "00f4004b-00b4-00c2-002b-009b002500d0.png",
        "timestamp": 1616014001702,
        "duration": 974
    },
    {
        "description": "Muestra mensaje error Nombre obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9188,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616014003742,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616014003742,
                "type": ""
            }
        ],
        "screenShotFile": "00a5002c-009f-00a2-00c1-008200100059.png",
        "timestamp": 1616014003007,
        "duration": 905
    },
    {
        "description": "deber??a mostrar p??gina de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 17668,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00c80049-00a4-00c6-0002-00e000ce0010.png",
        "timestamp": 1616014179264,
        "duration": 934
    },
    {
        "description": "Muestra mensajes error campos obligatorios|work-space project libro",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 17668,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: javascript error: localStorage.serItem is not a function\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.19042 x86_64)"
        ],
        "trace": [
            "JavascriptError: javascript error: localStorage.serItem is not a function\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.19042 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebDriver.executeScript()\n    at Driver.schedule (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at Driver.executeScript (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:878:16)\n    at run (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:58:33)\n    at ProtractorBrowser.to.<computed> (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:66:16)\n    at UserContext.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\test\\libro.e2e-spec.ts:13:13)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"Muestra mensajes error campos obligatorios\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError: \n    at Suite.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\test\\libro.e2e-spec.ts:11:3)\n    at addSpecsToSuite (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\test\\libro.e2e-spec.ts:4:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Module.m._compile (D:\\Proyectos\\ADNCeiba\\angular-base\\node_modules\\ts-node\\src\\index.ts:439:23)\n    at Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Object.require.extensions.<computed> [as .ts] (D:\\Proyectos\\ADNCeiba\\angular-base\\node_modules\\ts-node\\src\\index.ts:442:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "00be00d6-0070-00d9-00bd-001a0070001a.png",
        "timestamp": 1616014180713,
        "duration": 771
    },
    {
        "description": "deber??a mostrar mensaje error email obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 17668,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616014181555,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616014181555,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616014182592,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616014182593,
                "type": ""
            }
        ],
        "screenShotFile": "002e0039-0035-001f-0019-00a9009000bc.png",
        "timestamp": 1616014181805,
        "duration": 926
    },
    {
        "description": "deber??a mostrar mensaje error email no valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 17668,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616014183916,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616014183917,
                "type": ""
            }
        ],
        "screenShotFile": "00fc00b1-00d0-00c1-0066-007300600054.png",
        "timestamp": 1616014183088,
        "duration": 916
    },
    {
        "description": "muestra mensaje error password obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 17668,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616014185173,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616014185173,
                "type": ""
            }
        ],
        "screenShotFile": "000000de-0083-005f-00ce-00a0001e00da.png",
        "timestamp": 1616014184345,
        "duration": 910
    },
    {
        "description": "redirecciona a la p??gina de home si login es valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 17668,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616014186415,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616014186415,
                "type": ""
            }
        ],
        "screenShotFile": "008400fd-00ef-0066-0064-003000020063.png",
        "timestamp": 1616014185562,
        "duration": 1843
    },
    {
        "description": "Muestra mensaje error ISBN obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 17668,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616014188436,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616014188436,
                "type": ""
            }
        ],
        "screenShotFile": "00a4004d-0081-00eb-0006-008800180046.png",
        "timestamp": 1616014187691,
        "duration": 899
    },
    {
        "description": "Muestra mensaje error Nombre obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 17668,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616014189652,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616014189653,
                "type": ""
            }
        ],
        "screenShotFile": "004100ce-00d6-00be-009e-0013006b0078.png",
        "timestamp": 1616014188899,
        "duration": 962
    },
    {
        "description": "deber??a mostrar p??gina de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9212,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00ba006a-00ed-0004-000a-0086003400e2.png",
        "timestamp": 1616014277112,
        "duration": 1065
    },
    {
        "description": "Muestra mensajes error campos obligatorios|work-space project libro",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 9212,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: javascript error: window.localStorage.serItem is not a function\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.19042 x86_64)"
        ],
        "trace": [
            "JavascriptError: javascript error: window.localStorage.serItem is not a function\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.19042 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebDriver.executeScript()\n    at Driver.schedule (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at Driver.executeScript (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:878:16)\n    at run (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:58:33)\n    at ProtractorBrowser.to.<computed> (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:66:16)\n    at UserContext.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\test\\libro.e2e-spec.ts:13:13)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"Muestra mensajes error campos obligatorios\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError: \n    at Suite.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\test\\libro.e2e-spec.ts:11:3)\n    at addSpecsToSuite (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\test\\libro.e2e-spec.ts:4:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Module.m._compile (D:\\Proyectos\\ADNCeiba\\angular-base\\node_modules\\ts-node\\src\\index.ts:439:23)\n    at Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Object.require.extensions.<computed> [as .ts] (D:\\Proyectos\\ADNCeiba\\angular-base\\node_modules\\ts-node\\src\\index.ts:442:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "00080094-00ee-006d-008e-00ab0034008f.png",
        "timestamp": 1616014278668,
        "duration": 707
    },
    {
        "description": "deber??a mostrar mensaje error email obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9212,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616014279461,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616014279461,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616014280521,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616014280521,
                "type": ""
            }
        ],
        "screenShotFile": "003d0077-0044-00de-00e8-00000080001c.png",
        "timestamp": 1616014279688,
        "duration": 925
    },
    {
        "description": "deber??a mostrar mensaje error email no valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9212,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616014281784,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616014281785,
                "type": ""
            }
        ],
        "screenShotFile": "009c00ee-008e-00b3-00d3-004d00ac00d9.png",
        "timestamp": 1616014280940,
        "duration": 1016
    },
    {
        "description": "muestra mensaje error password obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9212,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616014283091,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616014283092,
                "type": ""
            }
        ],
        "screenShotFile": "0013005d-002e-00b9-009e-003e00ea005e.png",
        "timestamp": 1616014282271,
        "duration": 925
    },
    {
        "description": "redirecciona a la p??gina de home si login es valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9212,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616014284323,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616014284324,
                "type": ""
            }
        ],
        "screenShotFile": "000e000b-006c-00a2-009b-004d009e00b6.png",
        "timestamp": 1616014283506,
        "duration": 2043
    },
    {
        "description": "Muestra mensaje error ISBN obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9212,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616014286656,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616014286657,
                "type": ""
            }
        ],
        "screenShotFile": "0018008f-00f7-0046-00b2-0026007600e8.png",
        "timestamp": 1616014285892,
        "duration": 991
    },
    {
        "description": "Muestra mensaje error Nombre obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9212,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616014288079,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616014288079,
                "type": ""
            }
        ],
        "screenShotFile": "009c0092-0041-0048-00c0-005500e30095.png",
        "timestamp": 1616014287259,
        "duration": 1026
    },
    {
        "description": "deber??a mostrar p??gina de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 1996,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00cc00c5-00e4-00bb-001f-00e4003a0021.png",
        "timestamp": 1616014300840,
        "duration": 983
    },
    {
        "description": "Muestra mensajes error campos obligatorios|work-space project libro",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 1996,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616014303257,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616014303257,
                "type": ""
            }
        ],
        "screenShotFile": "00d300a7-00f4-00a9-00e2-00720041009e.png",
        "timestamp": 1616014302353,
        "duration": 900
    },
    {
        "description": "deber??a mostrar mensaje error email obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 1996,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616014304425,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616014304425,
                "type": ""
            }
        ],
        "screenShotFile": "00e60083-005b-0009-0084-00a00010006d.png",
        "timestamp": 1616014303570,
        "duration": 918
    },
    {
        "description": "deber??a mostrar mensaje error email no valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 1996,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616014305640,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616014305640,
                "type": ""
            }
        ],
        "screenShotFile": "008a00f9-00cc-0015-0012-0085001f0055.png",
        "timestamp": 1616014304816,
        "duration": 998
    },
    {
        "description": "muestra mensaje error password obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 1996,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616014306994,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616014306994,
                "type": ""
            }
        ],
        "screenShotFile": "0018007d-00f6-00e1-0009-002f002700a6.png",
        "timestamp": 1616014306131,
        "duration": 946
    },
    {
        "description": "redirecciona a la p??gina de home si login es valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 1996,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616014308275,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616014308275,
                "type": ""
            }
        ],
        "screenShotFile": "0042003a-005e-00ca-00e3-00a400370025.png",
        "timestamp": 1616014307397,
        "duration": 2039
    },
    {
        "description": "Muestra mensaje error ISBN obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 1996,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616014310605,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616014310606,
                "type": ""
            }
        ],
        "screenShotFile": "000b0029-00b1-0085-00ea-009a00df0044.png",
        "timestamp": 1616014309770,
        "duration": 875
    },
    {
        "description": "Muestra mensaje error Nombre obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 1996,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616014311768,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616014311768,
                "type": ""
            }
        ],
        "screenShotFile": "004c0068-00aa-0070-0016-0004001a002a.png",
        "timestamp": 1616014311021,
        "duration": 789
    },
    {
        "description": "deber??a mostrar p??gina de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 10436,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00d50029-006c-0022-00a6-005c00bf0060.png",
        "timestamp": 1616014366406,
        "duration": 790
    },
    {
        "description": "Muestra mensajes error campos obligatorios|work-space project libro",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 10436,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00df00f7-0004-00a7-00a2-000b00c90064.png",
        "timestamp": 1616014367758,
        "duration": 20866
    },
    {
        "description": "deber??a mostrar mensaje error email obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 10436,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616014390075,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616014390075,
                "type": ""
            }
        ],
        "screenShotFile": "00c700e1-0043-003e-00ca-00b900c70039.png",
        "timestamp": 1616014388961,
        "duration": 1231
    },
    {
        "description": "deber??a mostrar mensaje error email no valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 10436,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616014391395,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616014391395,
                "type": ""
            }
        ],
        "screenShotFile": "00dd00eb-0062-00e9-0055-00b600680066.png",
        "timestamp": 1616014390539,
        "duration": 1056
    },
    {
        "description": "muestra mensaje error password obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 10436,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00530010-0051-0072-0052-00490057008c.png",
        "timestamp": 1616014391975,
        "duration": 846
    },
    {
        "description": "redirecciona a la p??gina de home si login es valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 10436,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616014392838,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616014392839,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616014393990,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616014393990,
                "type": ""
            }
        ],
        "screenShotFile": "005f00b1-00e7-0047-0043-001000340088.png",
        "timestamp": 1616014393133,
        "duration": 2044
    },
    {
        "description": "Muestra mensaje error ISBN obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 10436,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616014396361,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616014396362,
                "type": ""
            }
        ],
        "screenShotFile": "00f70034-0081-00c2-00ae-000b004100cb.png",
        "timestamp": 1616014395508,
        "duration": 925
    },
    {
        "description": "Muestra mensaje error Nombre obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 10436,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616014397622,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616014397623,
                "type": ""
            }
        ],
        "screenShotFile": "0006007a-0013-005c-0031-00dd009d00b6.png",
        "timestamp": 1616014396774,
        "duration": 1104
    },
    {
        "description": "deber??a mostrar p??gina de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 13196,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "004b002e-0051-00c5-0012-009900230051.png",
        "timestamp": 1616014519449,
        "duration": 982
    },
    {
        "description": "Muestra mensajes error campos obligatorios|work-space project libro",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 13196,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00de00bd-0043-00bd-00dd-006b00ab0022.png",
        "timestamp": 1616014520962,
        "duration": 20852
    },
    {
        "description": "deber??a mostrar mensaje error email obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 13196,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616014543107,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616014543108,
                "type": ""
            }
        ],
        "screenShotFile": "00bd00a8-00d6-0070-00d3-000d00ee0075.png",
        "timestamp": 1616014542163,
        "duration": 978
    },
    {
        "description": "deber??a mostrar mensaje error email no valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 13196,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616014544526,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616014544526,
                "type": ""
            }
        ],
        "screenShotFile": "00d800f6-0083-006b-00ae-00b7004500d9.png",
        "timestamp": 1616014543505,
        "duration": 1170
    },
    {
        "description": "muestra mensaje error password obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 13196,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616014546068,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616014546069,
                "type": ""
            }
        ],
        "screenShotFile": "00c600dc-0035-0061-0078-004d009400b3.png",
        "timestamp": 1616014545084,
        "duration": 1087
    },
    {
        "description": "redirecciona a la p??gina de home si login es valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 13196,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616014547522,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616014547522,
                "type": ""
            }
        ],
        "screenShotFile": "006d00d8-004c-00f9-0001-00260082004d.png",
        "timestamp": 1616014546496,
        "duration": 2226
    },
    {
        "description": "Muestra mensaje error ISBN obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 13196,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616014549883,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616014549883,
                "type": ""
            }
        ],
        "screenShotFile": "00da00df-00b4-00f9-0048-0094005800b3.png",
        "timestamp": 1616014549026,
        "duration": 1174
    },
    {
        "description": "Muestra mensaje error Nombre obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 13196,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616014551404,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616014551404,
                "type": ""
            }
        ],
        "screenShotFile": "00be006c-0027-0022-00d6-008b001c006a.png",
        "timestamp": 1616014550522,
        "duration": 924
    },
    {
        "description": "deber??a mostrar p??gina de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 19168,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00b7002b-008f-00a7-00bf-007200670067.png",
        "timestamp": 1616015761496,
        "duration": 817
    },
    {
        "description": "Muestra mensajes error campos obligatorios|work-space project libro",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 19168,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0066003c-00f0-00ca-002b-008700a100eb.png",
        "timestamp": 1616015762851,
        "duration": 677
    },
    {
        "description": "deber??a mostrar mensaje error email obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 19168,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616015763641,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616015763642,
                "type": ""
            }
        ],
        "screenShotFile": "001b00ee-00bd-0025-003a-00b4007600b8.png",
        "timestamp": 1616015763882,
        "duration": 794
    },
    {
        "description": "deber??a mostrar mensaje error email no valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 19168,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616015764683,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616015764683,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616015765890,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616015765890,
                "type": ""
            }
        ],
        "screenShotFile": "007300b5-0069-00e9-007f-00b600960078.png",
        "timestamp": 1616015765008,
        "duration": 916
    },
    {
        "description": "muestra mensaje error password obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 19168,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616015767140,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616015767140,
                "type": ""
            }
        ],
        "screenShotFile": "00450015-0085-00f0-006b-005200f100bd.png",
        "timestamp": 1616015766247,
        "duration": 1007
    },
    {
        "description": "redirecciona a la p??gina de home si login es valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 19168,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616015768401,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616015768401,
                "type": ""
            }
        ],
        "screenShotFile": "003e0013-00b6-00bd-00be-005000b6009e.png",
        "timestamp": 1616015767556,
        "duration": 1972
    },
    {
        "description": "Muestra mensaje error ISBN obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 19168,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616015770584,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616015770584,
                "type": ""
            }
        ],
        "screenShotFile": "0019000e-004d-0076-0082-0076002e00c2.png",
        "timestamp": 1616015769805,
        "duration": 892
    },
    {
        "description": "Muestra mensaje error Nombre obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 19168,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616015771712,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616015771713,
                "type": ""
            }
        ],
        "screenShotFile": "00a20023-00f8-0028-0013-00910098001c.png",
        "timestamp": 1616015770993,
        "duration": 927
    },
    {
        "description": "deber??a mostrar p??gina de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 17504,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "002d00b2-00b8-00f1-0029-002500530078.png",
        "timestamp": 1616016230485,
        "duration": 851
    },
    {
        "description": "Muestra mensaje error isbn obligatorio|work-space project libro",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 17504,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "008800dd-0095-009b-00a4-003c00d000bf.png",
        "timestamp": 1616016231887,
        "duration": 902
    },
    {
        "description": "deber??a mostrar mensaje error email obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 17504,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616016233917,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616016233918,
                "type": ""
            }
        ],
        "screenShotFile": "00df007f-0086-0077-00e4-003400fa0025.png",
        "timestamp": 1616016233091,
        "duration": 998
    },
    {
        "description": "deber??a mostrar mensaje error email no valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 17504,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616016235248,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616016235248,
                "type": ""
            }
        ],
        "screenShotFile": "00e70005-00a3-001e-00ad-0078004600a3.png",
        "timestamp": 1616016234443,
        "duration": 887
    },
    {
        "description": "muestra mensaje error password obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 17504,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616016236608,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616016236608,
                "type": ""
            }
        ],
        "screenShotFile": "0057008f-0053-0012-00c6-005200a0005a.png",
        "timestamp": 1616016235711,
        "duration": 999
    },
    {
        "description": "redirecciona a la p??gina de home si login es valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 17504,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616016237864,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616016237865,
                "type": ""
            }
        ],
        "screenShotFile": "00a6009b-0078-00a3-0006-00f100d80026.png",
        "timestamp": 1616016237008,
        "duration": 2011
    },
    {
        "description": "Muestra mensaje error ISBN obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 17504,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616016240185,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616016240186,
                "type": ""
            }
        ],
        "screenShotFile": "006d001c-0090-00e9-00c6-00c400400024.png",
        "timestamp": 1616016239311,
        "duration": 1097
    },
    {
        "description": "Muestra mensaje error Nombre obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 17504,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616016241506,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616016241506,
                "type": ""
            }
        ],
        "screenShotFile": "00f6007b-00bb-00c3-0049-008800b5009a.png",
        "timestamp": 1616016240731,
        "duration": 916
    },
    {
        "description": "deber??a mostrar p??gina de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8456,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00cf001c-002e-0046-00a4-00d9005700f1.png",
        "timestamp": 1616018561178,
        "duration": 1341
    },
    {
        "description": "Muestra mensaje error isbn obligatorio|work-space project libro",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8456,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00ec006e-0081-00c7-005b-00ae004c0002.png",
        "timestamp": 1616018563321,
        "duration": 886
    },
    {
        "description": "deber??a mostrar mensaje error email obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8456,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616018565303,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616018565303,
                "type": ""
            }
        ],
        "screenShotFile": "0048002a-00de-0047-00d5-00e600390081.png",
        "timestamp": 1616018564506,
        "duration": 963
    },
    {
        "description": "deber??a mostrar mensaje error email no valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8456,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616018566661,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616018566661,
                "type": ""
            }
        ],
        "screenShotFile": "000200c4-00ab-0077-00bb-004d003e00f9.png",
        "timestamp": 1616018565853,
        "duration": 876
    },
    {
        "description": "muestra mensaje error password obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8456,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616018567934,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616018567934,
                "type": ""
            }
        ],
        "screenShotFile": "007e0044-0098-00bd-0096-00a7003b00af.png",
        "timestamp": 1616018567106,
        "duration": 936
    },
    {
        "description": "redirecciona a la p??gina de home si login es valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8456,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616018569395,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616018569395,
                "type": ""
            }
        ],
        "screenShotFile": "008000ff-0074-0003-0052-0057002e007c.png",
        "timestamp": 1616018568406,
        "duration": 2036
    },
    {
        "description": "Muestra mensaje error ISBN obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8456,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616018571578,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616018571578,
                "type": ""
            }
        ],
        "screenShotFile": "005600f8-00e0-0028-0018-00b000b9005a.png",
        "timestamp": 1616018570749,
        "duration": 869
    },
    {
        "description": "Muestra mensaje error Nombre obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8456,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616018572698,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616018572699,
                "type": ""
            }
        ],
        "screenShotFile": "003b00bf-0033-0075-0098-00ae00100052.png",
        "timestamp": 1616018571948,
        "duration": 893
    },
    {
        "description": "deber??a mostrar p??gina de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 19852,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "008200bc-0080-008a-00e0-008d0039000f.png",
        "timestamp": 1616022956402,
        "duration": 1668
    },
    {
        "description": "Muestra mensaje error isbn obligatorio|work-space project libro",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 19852,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00a20054-00ea-00a1-004a-003500370046.png",
        "timestamp": 1616022958669,
        "duration": 1020
    },
    {
        "description": "deber??a mostrar mensaje error email obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 19852,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616022960859,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616022960859,
                "type": ""
            }
        ],
        "screenShotFile": "00f30053-00ea-0050-0061-00eb002d00a4.png",
        "timestamp": 1616022960003,
        "duration": 946
    },
    {
        "description": "deber??a mostrar mensaje error email no valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 19852,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616022962024,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616022962025,
                "type": ""
            }
        ],
        "screenShotFile": "00ee0067-00da-00d0-0046-000d00160043.png",
        "timestamp": 1616022961275,
        "duration": 883
    },
    {
        "description": "muestra mensaje error password obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 19852,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616022963351,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616022963352,
                "type": ""
            }
        ],
        "screenShotFile": "00c000bb-0020-00e9-00d7-007b00520099.png",
        "timestamp": 1616022962483,
        "duration": 1009
    },
    {
        "description": "redirecciona a la p??gina de home si login es valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 19852,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616022964704,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616022964705,
                "type": ""
            }
        ],
        "screenShotFile": "00200038-009e-0012-00f2-0081002400f5.png",
        "timestamp": 1616022963792,
        "duration": 2085
    },
    {
        "description": "Muestra mensaje error ISBN obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 19852,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616022966877,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616022966878,
                "type": ""
            }
        ],
        "screenShotFile": "0080009c-002f-0066-00f1-006c00a8004b.png",
        "timestamp": 1616022966168,
        "duration": 980
    },
    {
        "description": "Muestra mensaje error Nombre obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 19852,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616022968196,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616022968196,
                "type": ""
            }
        ],
        "screenShotFile": "003d00cf-008a-00d2-004e-003400e800ae.png",
        "timestamp": 1616022967460,
        "duration": 779
    },
    {
        "description": "deber??a mostrar p??gina de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 2396,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00a700e8-0010-00e5-002a-0043001400a4.png",
        "timestamp": 1616023062277,
        "duration": 1270
    },
    {
        "description": "Muestra mensaje error isbn obligatorio|work-space project libro",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 2396,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00660004-00f8-00f9-00cd-00f000c60086.png",
        "timestamp": 1616023064162,
        "duration": 845
    },
    {
        "description": "deber??a mostrar mensaje error email obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 2396,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "007f003c-00a9-000e-0001-00d100de004a.png",
        "timestamp": 1616023065307,
        "duration": 782
    },
    {
        "description": "deber??a mostrar mensaje error email no valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 2396,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616023066103,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616023066104,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616023067256,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616023067257,
                "type": ""
            }
        ],
        "screenShotFile": "00d700e1-00fd-0048-00a7-0000007e00eb.png",
        "timestamp": 1616023066414,
        "duration": 900
    },
    {
        "description": "muestra mensaje error password obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 2396,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616023068476,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616023068477,
                "type": ""
            }
        ],
        "screenShotFile": "003500c1-00dc-005b-008b-004f00a00040.png",
        "timestamp": 1616023067641,
        "duration": 941
    },
    {
        "description": "redirecciona a la p??gina de home si login es valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 2396,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616023069792,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616023069793,
                "type": ""
            }
        ],
        "screenShotFile": "00f6009e-0024-0056-0054-00d5003b0036.png",
        "timestamp": 1616023068914,
        "duration": 1899
    },
    {
        "description": "Muestra mensaje error ISBN obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 2396,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616023071963,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616023071963,
                "type": ""
            }
        ],
        "screenShotFile": "00aa0021-0001-00af-0086-000a00300022.png",
        "timestamp": 1616023071152,
        "duration": 981
    },
    {
        "description": "Muestra mensaje error Nombre obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 2396,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616023073238,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616023073239,
                "type": ""
            }
        ],
        "screenShotFile": "008200e1-009c-00ea-00ab-008300550095.png",
        "timestamp": 1616023072501,
        "duration": 896
    },
    {
        "description": "deber??a mostrar p??gina de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3152,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00dc009e-0033-00a4-0007-00d80041000e.png",
        "timestamp": 1616023686174,
        "duration": 814
    },
    {
        "description": "deber??a mostrar mensaje error email obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3152,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616023687197,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616023687198,
                "type": ""
            }
        ],
        "screenShotFile": "0037004b-0018-00c7-008f-0013003f00cf.png",
        "timestamp": 1616023687512,
        "duration": 791
    },
    {
        "description": "deber??a mostrar mensaje error email no valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3152,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616023688327,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616023688328,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616023689462,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616023689462,
                "type": ""
            }
        ],
        "screenShotFile": "00ba0007-0018-0077-0087-00d400ad0075.png",
        "timestamp": 1616023688627,
        "duration": 916
    },
    {
        "description": "muestra mensaje error password obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3152,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616023690743,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616023690743,
                "type": ""
            }
        ],
        "screenShotFile": "00c100d6-00b6-0086-00ca-008b006b00c3.png",
        "timestamp": 1616023689890,
        "duration": 947
    },
    {
        "description": "redirecciona a la p??gina de home si login es valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3152,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616023692049,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616023692050,
                "type": ""
            }
        ],
        "screenShotFile": "000b00cc-008e-0068-0075-009c00a80023.png",
        "timestamp": 1616023691197,
        "duration": 2117
    },
    {
        "description": "Muestra mensaje error ISBN obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3152,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616023694530,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616023694531,
                "type": ""
            }
        ],
        "screenShotFile": "00640057-001e-00d7-0075-00680076001b.png",
        "timestamp": 1616023693657,
        "duration": 1017
    },
    {
        "description": "Muestra mensaje error Nombre obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3152,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616023695874,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616023695874,
                "type": ""
            }
        ],
        "screenShotFile": "000100bd-005b-004a-00c3-000300d3008e.png",
        "timestamp": 1616023694981,
        "duration": 1035
    },
    {
        "description": "deber??a mostrar p??gina de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 16772,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "008600c2-00e3-0084-00cd-00a5002b0065.png",
        "timestamp": 1616023928926,
        "duration": 940
    },
    {
        "description": "Muestra mensaje error isbn obligatorio|work-space project libro",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 16772,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00c3002d-0049-0031-00ba-0000000f00a8.png",
        "timestamp": 1616023930393,
        "duration": 711
    },
    {
        "description": "deber??a mostrar mensaje error email obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 16772,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616023931194,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616023931195,
                "type": ""
            }
        ],
        "screenShotFile": "00d800fb-0081-00c9-0089-0063000f001e.png",
        "timestamp": 1616023931440,
        "duration": 777
    },
    {
        "description": "deber??a mostrar mensaje error email no valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 16772,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616023932250,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616023932251,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616023933379,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616023933379,
                "type": ""
            }
        ],
        "screenShotFile": "00450027-002e-007a-00b2-002600d200d7.png",
        "timestamp": 1616023932577,
        "duration": 913
    },
    {
        "description": "muestra mensaje error password obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 16772,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616023934621,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616023934621,
                "type": ""
            }
        ],
        "screenShotFile": "00680015-0073-0077-0054-001000df0049.png",
        "timestamp": 1616023933815,
        "duration": 977
    },
    {
        "description": "redirecciona a la p??gina de home si login es valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 16772,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616023935954,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616023935954,
                "type": ""
            }
        ],
        "screenShotFile": "00e70044-00fd-00b9-00b4-00ef001b0046.png",
        "timestamp": 1616023935088,
        "duration": 1901
    },
    {
        "description": "Muestra mensaje error ISBN obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 16772,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616023938177,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616023938178,
                "type": ""
            }
        ],
        "screenShotFile": "00b100e9-00b0-00f8-009d-006900e800d0.png",
        "timestamp": 1616023937281,
        "duration": 1059
    },
    {
        "description": "Muestra mensaje error Nombre obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 16772,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616023939415,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616023939415,
                "type": ""
            }
        ],
        "screenShotFile": "00de000b-005c-0028-003b-0020009400ad.png",
        "timestamp": 1616023938664,
        "duration": 886
    },
    {
        "description": "deber??a mostrar p??gina de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 12444,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00810047-008b-0046-0015-002a002c0056.png",
        "timestamp": 1616024640812,
        "duration": 951
    },
    {
        "description": "deber??a mostrar mensaje error email obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 12444,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616024641862,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616024641863,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616024643135,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616024643136,
                "type": ""
            }
        ],
        "screenShotFile": "000c009b-00ab-000e-00bf-002c00b400bd.png",
        "timestamp": 1616024642253,
        "duration": 920
    },
    {
        "description": "deber??a mostrar mensaje error email no valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 12444,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616024644307,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616024644307,
                "type": ""
            }
        ],
        "screenShotFile": "004b00c9-0012-00c8-0007-00320094004f.png",
        "timestamp": 1616024643496,
        "duration": 978
    },
    {
        "description": "muestra mensaje error password obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 12444,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616024645638,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616024645639,
                "type": ""
            }
        ],
        "screenShotFile": "00ae00b7-0029-00f8-00d4-00ce0078007e.png",
        "timestamp": 1616024644812,
        "duration": 887
    },
    {
        "description": "redirecciona a la p??gina de home si login es valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 12444,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616024646849,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616024646850,
                "type": ""
            }
        ],
        "screenShotFile": "00c900d2-00f6-0037-007d-00300003009f.png",
        "timestamp": 1616024646014,
        "duration": 2000
    },
    {
        "description": "Muestra mensaje error ISBN obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 12444,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616024649144,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616024649145,
                "type": ""
            }
        ],
        "screenShotFile": "00c8004e-0076-0052-00a1-00ee00280020.png",
        "timestamp": 1616024648345,
        "duration": 1015
    },
    {
        "description": "Muestra mensaje error Nombre obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 12444,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616024650467,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616024650467,
                "type": ""
            }
        ],
        "screenShotFile": "004d00ed-00f2-000c-0023-003200cd005d.png",
        "timestamp": 1616024649739,
        "duration": 896
    },
    {
        "description": "deber??a mostrar p??gina de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 20256,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00030090-00c2-0070-003d-00ac002100b5.png",
        "timestamp": 1616024696656,
        "duration": 962
    },
    {
        "description": "Muestra mensaje error isbn obligatorio|work-space project libro",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 20256,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616024697686,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616024697687,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616024698998,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616024698999,
                "type": ""
            }
        ],
        "screenShotFile": "00fe00c8-00ad-0006-0042-009300f9005f.png",
        "timestamp": 1616024698166,
        "duration": 920
    },
    {
        "description": "deber??a mostrar mensaje error email obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 20256,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616024700263,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616024700263,
                "type": ""
            }
        ],
        "screenShotFile": "006e00b1-0052-00b6-00d1-001100b70011.png",
        "timestamp": 1616024699452,
        "duration": 951
    },
    {
        "description": "deber??a mostrar mensaje error email no valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 20256,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616024701571,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616024701571,
                "type": ""
            }
        ],
        "screenShotFile": "00a200b3-006e-00a6-004f-00a2007a00e0.png",
        "timestamp": 1616024700766,
        "duration": 993
    },
    {
        "description": "muestra mensaje error password obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 20256,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616024702914,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616024702914,
                "type": ""
            }
        ],
        "screenShotFile": "00680051-0012-006a-00d0-00be00470077.png",
        "timestamp": 1616024702108,
        "duration": 906
    },
    {
        "description": "redirecciona a la p??gina de home si login es valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 20256,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616024704178,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616024704178,
                "type": ""
            }
        ],
        "screenShotFile": "00790076-0079-008e-00e9-007f00bc008b.png",
        "timestamp": 1616024703332,
        "duration": 1876
    },
    {
        "description": "Muestra mensaje error ISBN obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 20256,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616024706371,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616024706371,
                "type": ""
            }
        ],
        "screenShotFile": "00a50019-0006-0055-00d4-00d30082003d.png",
        "timestamp": 1616024705496,
        "duration": 1014
    },
    {
        "description": "Muestra mensaje error Nombre obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 20256,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1616024707551,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1616024707551,
                "type": ""
            }
        ],
        "screenShotFile": "0065000c-00c4-00a6-00f3-0061000b004d.png",
        "timestamp": 1616024706842,
        "duration": 748
    }
];

    this.sortSpecs = function () {
        this.results = results.sort(function sortFunction(a, b) {
    if (a.sessionId < b.sessionId) return -1;else if (a.sessionId > b.sessionId) return 1;

    if (a.timestamp < b.timestamp) return -1;else if (a.timestamp > b.timestamp) return 1;

    return 0;
});

    };

    this.setTitle = function () {
        var title = $('.report-title').text();
        titleService.setTitle(title);
    };

    // is run after all test data has been prepared/loaded
    this.afterLoadingJobs = function () {
        this.sortSpecs();
        this.setTitle();
    };

    this.loadResultsViaAjax = function () {

        $http({
            url: './combined.json',
            method: 'GET'
        }).then(function (response) {
                var data = null;
                if (response && response.data) {
                    if (typeof response.data === 'object') {
                        data = response.data;
                    } else if (response.data[0] === '"') { //detect super escaped file (from circular json)
                        data = CircularJSON.parse(response.data); //the file is escaped in a weird way (with circular json)
                    } else {
                        data = JSON.parse(response.data);
                    }
                }
                if (data) {
                    results = data;
                    that.afterLoadingJobs();
                }
            },
            function (error) {
                console.error(error);
            });
    };


    if (clientDefaults.useAjax) {
        this.loadResultsViaAjax();
    } else {
        this.afterLoadingJobs();
    }

}]);

app.filter('bySearchSettings', function () {
    return function (items, searchSettings) {
        var filtered = [];
        if (!items) {
            return filtered; // to avoid crashing in where results might be empty
        }
        var prevItem = null;

        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            item.displaySpecName = false;

            var isHit = false; //is set to true if any of the search criteria matched
            countLogMessages(item); // modifies item contents

            var hasLog = searchSettings.withLog && item.browserLogs && item.browserLogs.length > 0;
            if (searchSettings.description === '' ||
                (item.description && item.description.toLowerCase().indexOf(searchSettings.description.toLowerCase()) > -1)) {

                if (searchSettings.passed && item.passed || hasLog) {
                    isHit = true;
                } else if (searchSettings.failed && !item.passed && !item.pending || hasLog) {
                    isHit = true;
                } else if (searchSettings.pending && item.pending || hasLog) {
                    isHit = true;
                }
            }
            if (isHit) {
                checkIfShouldDisplaySpecName(prevItem, item);

                filtered.push(item);
                prevItem = item;
            }
        }

        return filtered;
    };
});

//formats millseconds to h m s
app.filter('timeFormat', function () {
    return function (tr, fmt) {
        if(tr == null){
            return "NaN";
        }

        switch (fmt) {
            case 'h':
                var h = tr / 1000 / 60 / 60;
                return "".concat(h.toFixed(2)).concat("h");
            case 'm':
                var m = tr / 1000 / 60;
                return "".concat(m.toFixed(2)).concat("min");
            case 's' :
                var s = tr / 1000;
                return "".concat(s.toFixed(2)).concat("s");
            case 'hm':
            case 'h:m':
                var hmMt = tr / 1000 / 60;
                var hmHr = Math.trunc(hmMt / 60);
                var hmMr = hmMt - (hmHr * 60);
                if (fmt === 'h:m') {
                    return "".concat(hmHr).concat(":").concat(hmMr < 10 ? "0" : "").concat(Math.round(hmMr));
                }
                return "".concat(hmHr).concat("h ").concat(hmMr.toFixed(2)).concat("min");
            case 'hms':
            case 'h:m:s':
                var hmsS = tr / 1000;
                var hmsHr = Math.trunc(hmsS / 60 / 60);
                var hmsM = hmsS / 60;
                var hmsMr = Math.trunc(hmsM - hmsHr * 60);
                var hmsSo = hmsS - (hmsHr * 60 * 60) - (hmsMr*60);
                if (fmt === 'h:m:s') {
                    return "".concat(hmsHr).concat(":").concat(hmsMr < 10 ? "0" : "").concat(hmsMr).concat(":").concat(hmsSo < 10 ? "0" : "").concat(Math.round(hmsSo));
                }
                return "".concat(hmsHr).concat("h ").concat(hmsMr).concat("min ").concat(hmsSo.toFixed(2)).concat("s");
            case 'ms':
                var msS = tr / 1000;
                var msMr = Math.trunc(msS / 60);
                var msMs = msS - (msMr * 60);
                return "".concat(msMr).concat("min ").concat(msMs.toFixed(2)).concat("s");
        }

        return tr;
    };
});


function PbrStackModalController($scope, $rootScope) {
    var ctrl = this;
    ctrl.rootScope = $rootScope;
    ctrl.getParent = getParent;
    ctrl.getShortDescription = getShortDescription;
    ctrl.convertTimestamp = convertTimestamp;
    ctrl.isValueAnArray = isValueAnArray;
    ctrl.toggleSmartStackTraceHighlight = function () {
        var inv = !ctrl.rootScope.showSmartStackTraceHighlight;
        ctrl.rootScope.showSmartStackTraceHighlight = inv;
    };
    ctrl.applySmartHighlight = function (line) {
        if ($rootScope.showSmartStackTraceHighlight) {
            if (line.indexOf('node_modules') > -1) {
                return 'greyout';
            }
            if (line.indexOf('  at ') === -1) {
                return '';
            }

            return 'highlight';
        }
        return '';
    };
}


app.component('pbrStackModal', {
    templateUrl: "pbr-stack-modal.html",
    bindings: {
        index: '=',
        data: '='
    },
    controller: PbrStackModalController
});

function PbrScreenshotModalController($scope, $rootScope) {
    var ctrl = this;
    ctrl.rootScope = $rootScope;
    ctrl.getParent = getParent;
    ctrl.getShortDescription = getShortDescription;

    /**
     * Updates which modal is selected.
     */
    this.updateSelectedModal = function (event, index) {
        var key = event.key; //try to use non-deprecated key first https://developer.mozilla.org/de/docs/Web/API/KeyboardEvent/keyCode
        if (key == null) {
            var keyMap = {
                37: 'ArrowLeft',
                39: 'ArrowRight'
            };
            key = keyMap[event.keyCode]; //fallback to keycode
        }
        if (key === "ArrowLeft" && this.hasPrevious) {
            this.showHideModal(index, this.previous);
        } else if (key === "ArrowRight" && this.hasNext) {
            this.showHideModal(index, this.next);
        }
    };

    /**
     * Hides the modal with the #oldIndex and shows the modal with the #newIndex.
     */
    this.showHideModal = function (oldIndex, newIndex) {
        const modalName = '#imageModal';
        $(modalName + oldIndex).modal("hide");
        $(modalName + newIndex).modal("show");
    };

}

app.component('pbrScreenshotModal', {
    templateUrl: "pbr-screenshot-modal.html",
    bindings: {
        index: '=',
        data: '=',
        next: '=',
        previous: '=',
        hasNext: '=',
        hasPrevious: '='
    },
    controller: PbrScreenshotModalController
});

app.factory('TitleService', ['$document', function ($document) {
    return {
        setTitle: function (title) {
            $document[0].title = title;
        }
    };
}]);


app.run(
    function ($rootScope, $templateCache) {
        //make sure this option is on by default
        $rootScope.showSmartStackTraceHighlight = true;
        
  $templateCache.put('pbr-screenshot-modal.html',
    '<div class="modal" id="imageModal{{$ctrl.index}}" tabindex="-1" role="dialog"\n' +
    '     aria-labelledby="imageModalLabel{{$ctrl.index}}" ng-keydown="$ctrl.updateSelectedModal($event,$ctrl.index)">\n' +
    '    <div class="modal-dialog modal-lg m-screenhot-modal" role="document">\n' +
    '        <div class="modal-content">\n' +
    '            <div class="modal-header">\n' +
    '                <button type="button" class="close" data-dismiss="modal" aria-label="Close">\n' +
    '                    <span aria-hidden="true">&times;</span>\n' +
    '                </button>\n' +
    '                <h6 class="modal-title" id="imageModalLabelP{{$ctrl.index}}">\n' +
    '                    {{$ctrl.getParent($ctrl.data.description)}}</h6>\n' +
    '                <h5 class="modal-title" id="imageModalLabel{{$ctrl.index}}">\n' +
    '                    {{$ctrl.getShortDescription($ctrl.data.description)}}</h5>\n' +
    '            </div>\n' +
    '            <div class="modal-body">\n' +
    '                <img class="screenshotImage" ng-src="{{$ctrl.data.screenShotFile}}">\n' +
    '            </div>\n' +
    '            <div class="modal-footer">\n' +
    '                <div class="pull-left">\n' +
    '                    <button ng-disabled="!$ctrl.hasPrevious" class="btn btn-default btn-previous" data-dismiss="modal"\n' +
    '                            data-toggle="modal" data-target="#imageModal{{$ctrl.previous}}">\n' +
    '                        Prev\n' +
    '                    </button>\n' +
    '                    <button ng-disabled="!$ctrl.hasNext" class="btn btn-default btn-next"\n' +
    '                            data-dismiss="modal" data-toggle="modal"\n' +
    '                            data-target="#imageModal{{$ctrl.next}}">\n' +
    '                        Next\n' +
    '                    </button>\n' +
    '                </div>\n' +
    '                <a class="btn btn-primary" href="{{$ctrl.data.screenShotFile}}" target="_blank">\n' +
    '                    Open Image in New Tab\n' +
    '                    <span class="glyphicon glyphicon-new-window" aria-hidden="true"></span>\n' +
    '                </a>\n' +
    '                <button type="button" class="btn btn-default" data-dismiss="modal">Close</button>\n' +
    '            </div>\n' +
    '        </div>\n' +
    '    </div>\n' +
    '</div>\n' +
     ''
  );

  $templateCache.put('pbr-stack-modal.html',
    '<div class="modal" id="modal{{$ctrl.index}}" tabindex="-1" role="dialog"\n' +
    '     aria-labelledby="stackModalLabel{{$ctrl.index}}">\n' +
    '    <div class="modal-dialog modal-lg m-stack-modal" role="document">\n' +
    '        <div class="modal-content">\n' +
    '            <div class="modal-header">\n' +
    '                <button type="button" class="close" data-dismiss="modal" aria-label="Close">\n' +
    '                    <span aria-hidden="true">&times;</span>\n' +
    '                </button>\n' +
    '                <h6 class="modal-title" id="stackModalLabelP{{$ctrl.index}}">\n' +
    '                    {{$ctrl.getParent($ctrl.data.description)}}</h6>\n' +
    '                <h5 class="modal-title" id="stackModalLabel{{$ctrl.index}}">\n' +
    '                    {{$ctrl.getShortDescription($ctrl.data.description)}}</h5>\n' +
    '            </div>\n' +
    '            <div class="modal-body">\n' +
    '                <div ng-if="$ctrl.data.trace.length > 0">\n' +
    '                    <div ng-if="$ctrl.isValueAnArray($ctrl.data.trace)">\n' +
    '                        <pre class="logContainer" ng-repeat="trace in $ctrl.data.trace track by $index"><div ng-class="$ctrl.applySmartHighlight(line)" ng-repeat="line in trace.split(\'\\n\') track by $index">{{line}}</div></pre>\n' +
    '                    </div>\n' +
    '                    <div ng-if="!$ctrl.isValueAnArray($ctrl.data.trace)">\n' +
    '                        <pre class="logContainer"><div ng-class="$ctrl.applySmartHighlight(line)" ng-repeat="line in $ctrl.data.trace.split(\'\\n\') track by $index">{{line}}</div></pre>\n' +
    '                    </div>\n' +
    '                </div>\n' +
    '                <div ng-if="$ctrl.data.browserLogs.length > 0">\n' +
    '                    <h5 class="modal-title">\n' +
    '                        Browser logs:\n' +
    '                    </h5>\n' +
    '                    <pre class="logContainer"><div class="browserLogItem"\n' +
    '                                                   ng-repeat="logError in $ctrl.data.browserLogs track by $index"><div><span class="label browserLogLabel label-default"\n' +
    '                                                                                                                             ng-class="{\'label-danger\': logError.level===\'SEVERE\', \'label-warning\': logError.level===\'WARNING\'}">{{logError.level}}</span><span class="label label-default">{{$ctrl.convertTimestamp(logError.timestamp)}}</span><div ng-repeat="messageLine in logError.message.split(\'\\\\n\') track by $index">{{ messageLine }}</div></div></div></pre>\n' +
    '                </div>\n' +
    '            </div>\n' +
    '            <div class="modal-footer">\n' +
    '                <button class="btn btn-default"\n' +
    '                        ng-class="{active: $ctrl.rootScope.showSmartStackTraceHighlight}"\n' +
    '                        ng-click="$ctrl.toggleSmartStackTraceHighlight()">\n' +
    '                    <span class="glyphicon glyphicon-education black"></span> Smart Stack Trace\n' +
    '                </button>\n' +
    '                <button type="button" class="btn btn-default" data-dismiss="modal">Close</button>\n' +
    '            </div>\n' +
    '        </div>\n' +
    '    </div>\n' +
    '</div>\n' +
     ''
  );

    });
