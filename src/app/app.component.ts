import { Component, OnInit, OnDestroy } from '@angular/core';
import { get } from 'lodash';
import { combineLatest, Observable, Subject } from 'rxjs';
import { map } from 'rxjs/operators';
import { BatchSelectionService } from '@congarevenuecloud/elements';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, OnDestroy {
  private readonly _destroying$ = new Subject<void>();
  showHeader: boolean = true;
  showDrawer$: Observable<boolean>;
  ready: boolean = false;

  constructor(private batchSelectionService: BatchSelectionService) { }

  ngOnInit() {
    this.showDrawer$ = combineLatest([
      this.batchSelectionService.getSelectedProducts(),
      this.batchSelectionService.getSelectedLineItems()
    ])
      .pipe(map(([productList, lineItemList]) => get(productList, 'length', 0) > 0 || get(lineItemList, 'length', 0) > 0));
  }

  ngOnDestroy(): void {
    this._destroying$.next(null);
    this._destroying$.complete();
  }
}