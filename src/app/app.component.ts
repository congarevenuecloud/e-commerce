import { Component, OnInit, OnDestroy } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { get } from 'lodash';
import { combineLatest, Observable, Subject } from 'rxjs';
import { map, takeUntil, filter, take } from 'rxjs/operators';
import { PlatformConstants } from '@congarevenuecloud/core';
import { UserService } from '@congarevenuecloud/ecommerce';
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
    private translateService: TranslateService,
    private router: Router,
    private userService: UserService
  ) { }

  ngOnInit() {
    this.handlePostLoginRedirect();
    this.setTranslatedTitle();
    this.showDrawer$ = combineLatest([
      this.batchSelectionService.getSelectedProducts(),
      this.batchSelectionService.getSelectedLineItems()
    ])
      .pipe(map(([productList, lineItemList]) => get(productList, 'length', 0) > 0 || get(lineItemList, 'length', 0) > 0));
  }

  private handlePostLoginRedirect(): void {
    const returnUrl = localStorage.getItem(PlatformConstants.REDIRECT_URL);
    if (returnUrl) {
      this.userService.isLoggedIn().pipe(
        filter(isLoggedIn => isLoggedIn === true),
        take(1)
      ).subscribe(() => {
        localStorage.removeItem(PlatformConstants.REDIRECT_URL);
        this.router.navigateByUrl(returnUrl);
      });
    }
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