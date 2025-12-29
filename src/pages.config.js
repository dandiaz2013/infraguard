import Analytics from './pages/Analytics';
import ArgumentBuilder from './pages/ArgumentBuilder';
import Dashboard from './pages/Dashboard';
import DocumentGenerator from './pages/DocumentGenerator';
import JudgmentAnalyzer from './pages/JudgmentAnalyzer';
import MatterDetail from './pages/MatterDetail';
import Matters from './pages/Matters';
import Research from './pages/Research';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Analytics": Analytics,
    "ArgumentBuilder": ArgumentBuilder,
    "Dashboard": Dashboard,
    "DocumentGenerator": DocumentGenerator,
    "JudgmentAnalyzer": JudgmentAnalyzer,
    "MatterDetail": MatterDetail,
    "Matters": Matters,
    "Research": Research,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};