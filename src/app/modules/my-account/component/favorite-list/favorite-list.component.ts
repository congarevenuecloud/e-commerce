import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { of, Observable, combineLatest } from 'rxjs';
import { switchMap, take, map as rmap, catchError, tap } from 'rxjs/operators';
import { first, get, isNil } from 'lodash';
import { FavoriteService, Favorite, UserService, User, AccountService, DateFormatPipe } from '@congarevenuecloud/ecommerce';
import { TableOptions, ExceptionService, TableAction } from '@congarevenuecloud/elements';

/** Favorite list component loads and shows all the favorite configurations for logged in user. */

@Component({
  selector: 'app-favorite-list',
  templateUrl: './favorite-list.component.html',
  styleUrls: ['./favorite-list.component.scss']
})
export class FavoriteListComponent implements OnInit {

  type = Favorite;

  // An observable with the aggregate count of favorites.
  totalRecords$: Observable<number>;

  // Options passed to table component to render the favorites in a grid view.
  tableOptions$: Observable<TableOptions>;
  view$: Observable<FavoriteListView>;
  user: User;
  payload: {};

  constructor(
    private favoriteService: FavoriteService,
    private userService: UserService,
    private accountService: AccountService,
    private exceptionService: ExceptionService,
    private router: Router,
    private dateFormatPipe: DateFormatPipe) { }

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    let tableOptions = {} as FavoriteListView;
    this.view$ = combineLatest([this.userService.getCurrentUser(), this.accountService.getCurrentAccount()])
      .pipe(
        switchMap(([user, account]) => {
          this.user = user;
          tableOptions = {
            tableOptions: {
              stickyColumnCount: 1,
              stickyColumns: [{
                prop: 'Name',
                label: 'FAVORITE.NAME'
              }],
              columns: [
                {
                  prop: 'Name',
                  label: 'FAVORITE.NAME'
                },
                {
                  prop: 'Description',
                  showPopover: true
                },
                {
                  prop: 'Scope',
                  label: 'FAVORITE.VISIBILITY'
                },
                {
                  prop: 'IsActive',
                  value: (record: Favorite) => record.IsActive ? of('Yes') : of('No'),
                  label: 'COMMON.ACTIVE',
                },
                {
                  prop: 'CreatedDate',
                  value: (record: Favorite) => this.getDateFormat(record)
                },
                {
                  prop: 'ModifiedDate',
                  value: (record: Favorite) => this.getDateFormat(record)
                }
              ],
              actions: [
                {
                  enabled: true,
                  icon: 'fa-check',
                  massAction: false,
                  label: 'COMMON.ADD_TO_CART',
                  theme: 'primary',
                  validate: (record: Favorite) => this.isActiveFavorite(record),
                  action: (recordList: Array<Favorite>) => this.addFavoriteToCart(first(recordList)),
                  disableReload: true
                } as TableAction,
                {
                  enabled: true,
                  icon: 'fa-pencil',
                  massAction: false,
                  label: 'COMMON.EDIT',
                  theme: 'primary',
                  validate: (record: Favorite) => this.canEdit(record),
                  action: (recordList: Array<Favorite>) => this.editFavorite(first(recordList)),
                  disableReload: true
                } as TableAction,
                {
                  enabled: true,
                  icon: 'fa-trash',
                  massAction: true,
                  label: 'COMMON.DELETE',
                  theme: 'danger',
                  validate: (record: Favorite) => this.canDelete(record),
                  action: (recordList: Array<Favorite>) => this.favoriteService.removeFavorites(recordList)
                    .pipe(
                      rmap(res => {
                        if (res) {
                          this.exceptionService.showSuccess('SUCCESS.FAVORITE.DELETED');
                          this.fetchFavoriteTotals();
                        }
                      }),
                      catchError((err) => {
                        this.fetchFavoriteTotals();
                        throw err;
                      })
                    ),
                  disableReload: true
                } as TableAction
              ],
              filters: null,
              routingLabel: 'favorites'
            }
          }
          this.fetchFavoriteTotals();
          return of(tableOptions);
        }));
  }

  private isActiveFavorite(favorite: Favorite) {
    return favorite.IsActive;
  }

  getDateFormat(record: Favorite) {
    return this.dateFormatPipe.transform(get(record, 'CreatedDate'));
  }

  private addFavoriteToCart(favorite: Favorite) {
    return this.favoriteService.addFavoriteToCart(favorite.Id).pipe(
      tap((res) => {
        if (res == true)
          this.exceptionService.showSuccess('SUCCESS.FAVORITE.ADD_FAVORITE_TO_CART', 'SUCCESS.FAVORITE.TITLE', { name: favorite.Name })
        else
          this.exceptionService.showError('ERROR.FAVORITE.ADD_FAVORITE_TO_CART_FAILED');
      })
    )
  }

  private canEdit(favorite: Favorite) {
    return this.isActiveFavorite(favorite) && get(favorite, 'CreatedById') === get(this.user, 'Id');
  }

  private editFavorite(favorite: Favorite) {
    this.router.navigate(['/favorites', favorite.Id]);
  }

  private canDelete(favorite: Favorite) {
    return get(favorite, 'CreatedById') === get(this.user, 'Id');
  }

  private fetchFavoriteTotals() {
    this.favoriteService.getMyFavorites()
      .pipe(
        rmap((result) => {
          this.totalRecords$ = !isNil(result) ? of(get(result, 'TotalRecord')) : of(0);
        }),
        take(1),
        catchError(error => {
          this.totalRecords$ = of(0);
          this.exceptionService.showError(error, 'ERROR.INVALID_REQUEST_ERROR_TOASTR_TITLE');
          return of(error);
        })
      ).subscribe();
  }
}
interface FavoriteListView {
  tableOptions: TableOptions;
}