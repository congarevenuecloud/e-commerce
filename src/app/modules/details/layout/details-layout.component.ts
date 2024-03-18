import { Component, ContentChildren, AfterContentInit, QueryList, ElementRef, HostListener, Input, ViewChild } from '@angular/core';
import { get, set, findIndex } from 'lodash';
import { AObject } from '@congarevenuecloud/core';
import { DetailSectionComponent } from '../detail-section/detail-section.component';
/**
 * Details Layout Component shows the details of the placed order or the requested quote.
 */
@Component({
  selector: 'app-detail',
  templateUrl: './details-layout.component.html',
  styleUrls: ['./details-layout.component.scss']
})
export class DetailsLayoutComponent implements AfterContentInit {

  @ContentChildren(DetailSectionComponent) sections: QueryList<DetailSectionComponent>;
  @ViewChild('primaryActions', { static: true }) primaryActions: any;
  @ViewChild('secondaryActions', { static: true }) secondaryActions: any;
  @ViewChild('headerNav', { static: true }) headerNav: ElementRef<any>;

  @Input() title: string;
  @Input() subtitle: string;
  @Input() context: AObject;
  @Input() route: string;

  private activeTabIndex = 0;

  hidePrimaryActions: boolean = false;
  hideSecondaryActions: boolean = false;

  ngAfterContentInit() {
    this.hidePrimaryActions = get(this, 'primaryActions.nativeElement.children.length', 0) <= 0;
    this.hideSecondaryActions = get(this, 'secondaryActions.nativeElement.children.length', 0) <= 0;
    set(this, 'sections.first.active', true);
  }

  /**
   * HostListener Decorator a DOM event to listen for, and provides a handler method to run when that 
   * event occurs. Here attaches listener to window on scroll event.
   * In onScroll method assigns headerClass property with the class "'fixed-top' | 'fixed-top expand'" based on window 
   * pageYOffset and set the tab active.
   */
  @HostListener('window:scroll', ['$event'])
  onScroll(event) {
    if (this.headerClass != null && window.pageYOffset < 35) {
      this.headerClass = 'fixed-top  position-fixed expand';
      setTimeout(() => this.headerClass = null, 200);
    } else if (window.pageYOffset >= 35) {
      this.headerClass = 'fixed-top position-fixed';
    } else {
      this.headerClass = null;
    }

    this.setActiveTab();
  }
  headerClass: 'fixed-top position-fixed' | 'fixed-top  position-fixed expand' = null;

  /**
   * scrollTo method scrolls the page to the specified tab content.
   */
  scrollTo(tab: DetailSectionComponent) {
    const index = findIndex(this.sections.toArray(), t => t.title === tab.title);
    if (index === 0)
      window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
    else
      window.scrollTo({ top: tab.element.nativeElement.offsetTop - this.headerNav.nativeElement.offsetHeight, left: 0, behavior: 'smooth' });
  }

  setActiveTab() {
    let index = 0;
    if (this.sections) {
      const amounts = this.sections.map(s => this.getElementPercentage(s.element.nativeElement));
      index = amounts.reduce((iMax, x, i, arr) => x > arr[iMax] ? i : iMax, 0);

      if (index !== this.activeTabIndex) {
        this.sections.forEach(t => t.active = false);
        this.sections.toArray()[index].active = true;
        this.activeTabIndex = index;
      }
    }
  }

  trackByComponent(index, tab: DetailSectionComponent) {
    return tab.title;
  }

  getElementPercentage(el) {
    let top = el.offsetTop;
    const height = el.offsetHeight;

    while (el.offsetParent) {
      el = el.offsetParent;
      top += el.offsetTop;
    }


    const startA = top;
    const endA = top + height;

    const startB = window.pageYOffset + this.headerNav.nativeElement.offsetHeight;
    const endB = window.pageYOffset + window.innerHeight;

    if (startB > endA || startA > endB)
      return 0;
    else {
      const startO = (startA > startB) ? startA : startB;
      const endO = (endA < endB) ? endA : endB;
      return (endO - startO) / height;
    }
  }

}
