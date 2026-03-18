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

}

