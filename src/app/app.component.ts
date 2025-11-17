import { Component, OnInit, OnDestroy } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { TranslateService } from '@ngx-translate/core';
import { get } from 'lodash';
import { combineLatest, Observable, Subject } from 'rxjs';
import { map, takeUntil, filter } from 'rxjs/operators';
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

  constructor(
    private batchSelectionService: BatchSelectionService, 
    private titleService: Title, 
    private translateService: TranslateService
  ) { }
  
  ngOnInit() {
    this.setTranslatedTitle();
    this.showDrawer$ = combineLatest([
      this.batchSelectionService.getSelectedProducts(),
      this.batchSelectionService.getSelectedLineItems()
    ])
      .pipe(map(([productList, lineItemList]) => get(productList, 'length', 0) > 0 || get(lineItemList, 'length', 0) > 0));
  }

  private setTranslatedTitle(): void {
    this.translateService.get('APP.TITLE')
      .pipe(
        filter(title => title !== 'APP.TITLE'),
        takeUntil(this._destroying$)
      )
      .subscribe(title => this.titleService.setTitle(title as string));
  }

  ngOnDestroy(): void {
    this._destroying$.next(null);
    this._destroying$.complete();
  }
}