export namespace main {
	
	export class Textbook {
	    id: string;
	    title: string;
	    color: string;
	
	    static createFrom(source: any = {}) {
	        return new Textbook(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.title = source["title"];
	        this.color = source["color"];
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

}

