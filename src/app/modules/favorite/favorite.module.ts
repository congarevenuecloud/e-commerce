import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LaddaModule } from 'angular2-ladda';
import { TranslateModule } from '@ngx-translate/core';
import { NgScrollbarModule } from 'ngx-scrollbar';
import { FavoriteRoutingModule } from './favorite-routing.module';
import { OutputFieldModule, LineItemTableRowModule, TableModule, InputFieldModule, BreadcrumbModule, IconModule, AlertModule } from '@congarevenuecloud/elements';
import { DetailsModule } from '../details/details.module';
import { FavoriteDetailsComponent } from './layout/favorite-details/favorite-details.component';

@NgModule({
  declarations: [
    FavoriteDetailsComponent
  ],
  imports: [
    CommonModule,
    FavoriteRoutingModule,
    LaddaModule,
    NgScrollbarModule,
    FormsModule,
    TranslateModule.forChild(),
    OutputFieldModule,
    DetailsModule,
    LineItemTableRowModule,
    TableModule,
    BreadcrumbModule,
    InputFieldModule,
    IconModule,
    AlertModule
  ]
})
export class FavoriteModule { }
