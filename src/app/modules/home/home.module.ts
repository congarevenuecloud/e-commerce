/**
* Conga Digital Commerce
*
* The home module is the landing page for the ecommerce application. It utilizes the
* product carousel and jumbotron component from the conga elements library test.
*/
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { HomeRoutingModule } from './home-routing.module';
import { HomeComponent } from './layout/home.component';
import { ComponentModule } from '../../components/component.module';

import { ProductCarouselModule, JumbotronModule, IconModule, AlertModule } from '@congarevenuecloud/elements';

@NgModule({
  imports: [
    CommonModule,
    HomeRoutingModule,
    ComponentModule,
    JumbotronModule,
    ProductCarouselModule,
    IconModule,
    AlertModule
  ],
  declarations: [HomeComponent]
})
export class HomeModule { }
