/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/


/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// Pinched form chat
import { IDisposable } from '../../../../../../base/common/lifecycle.js';
import { IObservable } from '../../../../../../base/common/observable.js';
import { URI } from '../../../../../..//base/common/uri.js';
import { IEditorPane } from '../../../../../common/editor.js';



export const enum ModifiedFileEntryState {
	Modified,
	Accepted,
	Rejected,
}

// /**
//  * Represents a part of a change
//  */
export interface IModifiedFileEntryChangeHunk {
	accept(): Promise<boolean>;
	reject(): Promise<boolean>;
}

export interface IModifiedFileEntryEditorIntegration extends IDisposable {

	/**
	 * The index of a change
	 */
	currentIndex: IObservable<number>;

	/**
	 * Reveal the first (`true`) or last (`false`) change
	 */
	reveal(firstOrLast: boolean, preserveFocus?: boolean): void;

	/**
	 * Go to next change and increate `currentIndex`
	 * @param wrap When at the last, start over again or not
	 * @returns If it went next
	 */
	next(wrap: boolean): boolean;

	/**
	 * @see `next`
	 */
	previous(wrap: boolean): boolean;

	/**
	 * Enable the accessible diff viewer for this editor
	 */
	enableAccessibleDiffView(): void;

	/**
	 * Accept the change given or the nearest
	 * @param change An opaque change object
	 */
	acceptNearestChange(change?: IModifiedFileEntryChangeHunk): Promise<void>;

	/**
	 * @see `acceptNearestChange`
	 */
	rejectNearestChange(change?: IModifiedFileEntryChangeHunk): Promise<void>;

	/**
	 * Toggle between diff-editor and normal editor
	 * @param change An opaque change object
	 * @param show Optional boolean to control if the diff should show
	 */
	toggleDiff(change: IModifiedFileEntryChangeHunk | undefined, show?: boolean): Promise<void>;
}

export interface IModifiedFileEntry {
	readonly entryId: string;
	readonly originalURI: URI;
	readonly modifiedURI: URI;

	readonly lastModifyingRequestId: string;

	readonly state: IObservable<ModifiedFileEntryState>;
	// readonly isCurrentlyBeingModifiedBy: IObservable<IChatResponseModel | undefined>;
	// readonly lastModifyingResponse: IObservable<IChatResponseModel | undefined>;
	readonly rewriteRatio: IObservable<number>;

	readonly waitsForLastEdits: IObservable<boolean>;

	accept(): Promise<void>;
	reject(): Promise<void>;

	reviewMode: IObservable<boolean>;
	autoAcceptController: IObservable<{ total: number; remaining: number; cancel(): void } | undefined>;
	enableReviewModeUntilSettled(): void;

	/**
	 * Number of changes for this file
	 */
	readonly changesCount: IObservable<number>;

	getEditorIntegration(editor: IEditorPane): IModifiedFileEntryEditorIntegration;
}




import { AsyncReferenceCollection, IReference, ReferenceCollection } from '../../../../../../base/common/lifecycle.js';
// import { IModifiedFileEntry } from '../../../../chat/common/chatEditingService.js';
import { INotebookService } from '../../../common/notebookService.js';
import { bufferToStream, VSBuffer } from '../../../../../../base/common/buffer.js';
import { NotebookTextModel } from '../../../common/model/notebookTextModel.js';
import { createDecorator, IInstantiationService } from '../../../../../../platform/instantiation/common/instantiation.js';
import { ITextModelService } from '../../../../../../editor/common/services/resolverService.js';


export const INotebookOriginalModelReferenceFactory = createDecorator<INotebookOriginalModelReferenceFactory>('INotebookOriginalModelReferenceFactory');

export interface INotebookOriginalModelReferenceFactory {
	readonly _serviceBrand: undefined;
	getOrCreate(fileEntry: IModifiedFileEntry, viewType: string): Promise<IReference<NotebookTextModel>>;
}


export class OriginalNotebookModelReferenceCollection extends ReferenceCollection<Promise<NotebookTextModel>> {
	private readonly modelsToDispose = new Set<string>();
	constructor(@INotebookService private readonly notebookService: INotebookService,
		@ITextModelService private readonly modelService: ITextModelService
	) {
		super();
	}

	protected override async createReferencedObject(key: string, fileEntry: IModifiedFileEntry, viewType: string): Promise<NotebookTextModel> {
		this.modelsToDispose.delete(key);
		const uri = fileEntry.originalURI;
		const model = this.notebookService.getNotebookTextModel(uri);
		if (model) {
			return model;
		}
		const modelRef = await this.modelService.createModelReference(uri);
		const bytes = VSBuffer.fromString(modelRef.object.textEditorModel.getValue());
		const stream = bufferToStream(bytes);
		modelRef.dispose();

		return this.notebookService.createNotebookTextModel(viewType, uri, stream);
	}
	protected override destroyReferencedObject(key: string, modelPromise: Promise<NotebookTextModel>): void {
		this.modelsToDispose.add(key);

		(async () => {
			try {
				const model = await modelPromise;

				if (!this.modelsToDispose.has(key)) {
					// return if model has been acquired again meanwhile
					return;
				}

				// Finally we can dispose the model
				model.dispose();
			} catch (error) {
				// ignore
			} finally {
				this.modelsToDispose.delete(key); // Untrack as being disposed
			}
		})();
	}
}

export class NotebookOriginalModelReferenceFactory implements INotebookOriginalModelReferenceFactory {
	readonly _serviceBrand: undefined;
	private _resourceModelCollection: OriginalNotebookModelReferenceCollection & ReferenceCollection<Promise<NotebookTextModel>> /* TS Fail */ | undefined = undefined;
	private get resourceModelCollection() {
		if (!this._resourceModelCollection) {
			this._resourceModelCollection = this.instantiationService.createInstance(OriginalNotebookModelReferenceCollection);
		}

		return this._resourceModelCollection;
	}

	private _asyncModelCollection: AsyncReferenceCollection<NotebookTextModel> | undefined = undefined;
	private get asyncModelCollection() {
		if (!this._asyncModelCollection) {
			this._asyncModelCollection = new AsyncReferenceCollection(this.resourceModelCollection);
		}

		return this._asyncModelCollection;
	}

	constructor(@IInstantiationService private readonly instantiationService: IInstantiationService) {
	}

	getOrCreate(fileEntry: IModifiedFileEntry, viewType: string): Promise<IReference<NotebookTextModel>> {
		return this.asyncModelCollection.acquire(fileEntry.originalURI.toString(), fileEntry, viewType);
	}
}
