import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { cloneDeep, get } from 'lodash';
import { UserService, AccountService, User, Account } from '@congarevenuecloud/ecommerce';
import { ExceptionService } from '@congarevenuecloud/elements';

/**
 * Loads user and account specific settings.
 */
@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss']
})
export class SettingsComponent implements OnInit {

  user$: Observable<User>;

  account$: Observable<Account>;

  /** @ignore */
  constructor(private userService: UserService,
    private accountService: AccountService,
    private exceptionService: ExceptionService) {
  }

  /** @ignore */
  ngOnInit() {
    this.user$ = this.userService.me().pipe(map((user: User) => {
      try {
        user.Locale = get(JSON.parse(user.Locale), 'Name');
      }
      catch (e) { }
      return cloneDeep(user);
    }));
    this.account$ = this.accountService.getCurrentAccount();
  }

  updateUser(user: User) {
    user.ExternalId = get(user, 'UserName');
    this.userService.updateCurrentUser(user).subscribe(() => {
    }, err => {
      this.exceptionService.showError(err);
    });
  }
}