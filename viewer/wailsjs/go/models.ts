export namespace main {
	
	export class Metadata {
	    numPages: number;
	    pageOffset: number;
	
	    static createFrom(source: any = {}) {
	        return new Metadata(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.numPages = source["numPages"];
	        this.pageOffset = source["pageOffset"];
	    }
	}
	export class PdfConvertResult {
	    success: boolean;
	    title: string;
	    numPages: number;
	    detectedOffset: number;
	    error?: string;
	
	    static createFrom(source: any = {}) {
	        return new PdfConvertResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.title = source["title"];
	        this.numPages = source["numPages"];
	        this.detectedOffset = source["detectedOffset"];
	        this.error = source["error"];
	    }
	}
	export class Textbook {
	    id: string;
	    title: string;
	    color: string;
	    numPages: number;
	    pageOffset: number;
	
	    static createFrom(source: any = {}) {
	        return new Textbook(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.title = source["title"];
	        this.color = source["color"];
	        this.numPages = source["numPages"];
	        this.pageOffset = source["pageOffset"];
	    }
	}
	export class UpdateStatus {
	    hasUpdate: boolean;
	    latestVer: string;
	    downloadUrl: string;
	    error: string;
	
	    static createFrom(source: any = {}) {
	        return new UpdateStatus(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.hasUpdate = source["hasUpdate"];
	        this.latestVer = source["latestVer"];
	        this.downloadUrl = source["downloadUrl"];
	        this.error = source["error"];
	    }
	}
	export class UsbTextbookCandidate {
	    id: string;
	    title: string;
	    drive: string;
	    type: string;
	    sourcePath: string;
	    pageCount: number;
	    fileSize: number;
	    fileSizeStr: string;
	    description: string;
	    isRecommended: boolean;
	
	    static createFrom(source: any = {}) {
	        return new UsbTextbookCandidate(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.title = source["title"];
	        this.drive = source["drive"];
	        this.type = source["type"];
	        this.sourcePath = source["sourcePath"];
	        this.pageCount = source["pageCount"];
	        this.fileSize = source["fileSize"];
	        this.fileSizeStr = source["fileSizeStr"];
	        this.description = source["description"];
	        this.isRecommended = source["isRecommended"];
	    }
	}
	export class WeeklyPlanItem {
	    period: number;
	    subject: string;
	    matchedBookId: string;
	    topic: string;
	    pageStr: string;
	    startPage: number;
	    endPage: number;
	    raw: string;
	
	    static createFrom(source: any = {}) {
	        return new WeeklyPlanItem(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.period = source["period"];
	        this.subject = source["subject"];
	        this.matchedBookId = source["matchedBookId"];
	        this.topic = source["topic"];
	        this.pageStr = source["pageStr"];
	        this.startPage = source["startPage"];
	        this.endPage = source["endPage"];
	        this.raw = source["raw"];
	    }
	}
	export class WeeklyPlanResult {
	    success: boolean;
	    title: string;
	    filePath: string;
	    startDate?: string;
	    endDate?: string;
	    weekRange?: string;
	    weekDates?: Record<string, string>;
	    schedule: Record<string, Array<WeeklyPlanItem>>;
	    error?: string;
	
	    static createFrom(source: any = {}) {
	        return new WeeklyPlanResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.title = source["title"];
	        this.filePath = source["filePath"];
	        this.startDate = source["startDate"];
	        this.endDate = source["endDate"];
	        this.weekRange = source["weekRange"];
	        this.weekDates = source["weekDates"];
	        this.schedule = this.convertValues(source["schedule"], Array<WeeklyPlanItem>, true);
	        this.error = source["error"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class WeeklyPlanSummary {
	    filePath: string;
	    title: string;
	    startDate: string;
	    endDate: string;
	    weekRange: string;
	    isCurrent: boolean;
	
	    static createFrom(source: any = {}) {
	        return new WeeklyPlanSummary(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.filePath = source["filePath"];
	        this.title = source["title"];
	        this.startDate = source["startDate"];
	        this.endDate = source["endDate"];
	        this.weekRange = source["weekRange"];
	        this.isCurrent = source["isCurrent"];
	    }
	}

}

